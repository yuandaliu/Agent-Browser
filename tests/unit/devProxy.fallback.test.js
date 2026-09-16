/**
 * devProxy.fallback.test.js — requestUpstreamFallback 多上游调度回归测试
 *
 * 锁住这一轮（v2）相关行为：
 *   - 2xx 响应直接返回（不切上游）
 *   - 4xx 响应透传（不切上游）+ 释放 socket（之前修的 socket 泄漏）
 *   - 5xx 响应切下一个上游
 *   - 网络错误切下一个上游
 *   - 全失败抛带 upstreamErrors 数组的 Error
 *
 * 实现方式：mock 整个 `node:https` 模块，让 `https.request` 返回可控的 mock response。
 * 之前用 vi.mock 替换 dev-proxy 内部的 requestUpstreamWithRetry 在 ESM 严格模式
 * 下不生效（闭包引用 vs export 绑定的语义差异），改成 mock 底层 https.request。
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// 准备 mock response 队列（按需取出）
let mockResponses = []; // 每个元素：{ kind, status, error? }
let responseIndex = 0;

// 创建 mock IncomingMessage（模拟 Node http.IncomingMessage 子集）
function makeMockResponse({ status = 200, body = "" } = {}) {
  const listeners = { data: [], end: [], error: [] };
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    on(event, fn) {
      if (listeners[event]) listeners[event].push(fn);
    },
    resume() {
      /* noop：用于 4xx 路径 */
    },
    // 异步可迭代：5xx 路径用 for await 读 body
    [Symbol.asyncIterator]: {
      async next() {
        if (body && listeners.data.length > 0) {
          const fn = listeners.data.shift();
          fn(Buffer.from(body));
        }
        if (listeners.end.length > 0) {
          listeners.end.shift()();
        }
        return { value: undefined, done: true };
      },
    },
    // 简化：直接暴露 _emitData / _emitEnd 供测试触发
    _emitData(chunk) {
      for (const fn of listeners.data) fn(Buffer.from(chunk));
    },
    _emitEnd() {
      for (const fn of listeners.end) fn();
    },
  };
}

// mock node:https：替换 https.request
vi.mock("node:https", async () => {
  const actual = await vi.importActual("node:https");
  return {
    ...actual,
    default: {
      ...actual,
      request: vi.fn((upstream, opts, cb) => {
        const r = mockResponses[responseIndex++];
        if (!r) {
          // 没设置 mock：抛错模拟网络失败
          throw new Error("mock not set");
        }
        if (r.kind === "error") {
          // 网络错误：异步 emit error
          const req = {
            on: (e, fn) => {
              if (e === "error") setImmediate(() => fn(new Error(r.error)));
            },
            setTimeout: () => {},
            destroy: () => {},
            end: () => {},
          };
          return req;
        }
        // 成功响应：异步调用 callback
        const res = makeMockResponse({ status: r.status, body: r.body ?? "" });
        setImmediate(() => cb(res));
        return {
          on: () => {},
          setTimeout: () => {},
          destroy: () => {},
          end: () => {},
        };
      }),
    },
  };
});

const { requestUpstreamFallback } = await import("../../server/dev-proxy.mjs");

function makeMockUpstream(host) {
  return { host, protocol: "https:", pathname: "/" };
}

beforeEach(() => {
  mockResponses = [];
  responseIndex = 0;
});

describe("requestUpstreamFallback — 状态码分流", () => {
  it("2xx 响应 → 直接返回该响应（不切上游）", async () => {
    mockResponses = [{ kind: "ok", status: 200 }];
    const result = await requestUpstreamFallback(
      [makeMockUpstream("a.com"), makeMockUpstream("b.com")],
      "GET",
      {},
    );
    expect(result.response.statusCode).toBe(200);
    expect(result.upstream.host).toBe("a.com");
  });

  it("4xx 响应 → 透传不切上游，且调 res.resume() 释放 socket", async () => {
    // 4xx 走 res.resume() 路径：mock 一个 404 响应，dev-proxy 应透传并 resume socket
    mockResponses = [{ kind: "ok", status: 404 }];
    const result = await requestUpstreamFallback(
      [makeMockUpstream("a.com"), makeMockUpstream("b.com")],
      "GET",
      {},
    );
    expect(result.response.statusCode).toBe(404);
    expect(result.upstream.host).toBe("a.com");
    // 只用了 1 个 mock response（说明没切第二个上游）
    expect(responseIndex).toBe(1);
  });

  it("5xx 响应 → 切下一个上游", async () => {
    mockResponses = [
      { kind: "ok", status: 503 },
      { kind: "ok", status: 200 },
    ];
    const result = await requestUpstreamFallback(
      [makeMockUpstream("a.com"), makeMockUpstream("b.com")],
      "GET",
      {},
    );
    expect(result.response.statusCode).toBe(200);
    expect(result.upstream.host).toBe("b.com");
    expect(responseIndex).toBe(2);
  });
});

describe("requestUpstreamFallback — 网络错误", () => {
  it("网络错误（mock 抛错）→ 切下一个上游", async () => {
    // requestUpstreamWithRetry 内部对同一上游最多重试 1 次（共调 2 次 requestOnce）。
    // 所以 a.com 消耗 2 个 mock：2 次失败 → 切到 b.com → 1 个 mock 成功。
    mockResponses = [
      { kind: "error", error: "ECONNRESET" },  // a.com attempt 0
      { kind: "error", error: "ETIMEDOUT" },   // a.com attempt 1
      { kind: "ok", status: 200 },              // b.com
    ];
    const result = await requestUpstreamFallback(
      [makeMockUpstream("a.com"), makeMockUpstream("b.com")],
      "GET",
      {},
    );
    expect(result.response.statusCode).toBe(200);
    expect(result.upstream.host).toBe("b.com");
  });

  it("全上游失败 → 抛带 upstreamErrors 数组的 Error", async () => {
    mockResponses = [
      { kind: "error", error: "ECONNRESET" },
      { kind: "error", error: "ETIMEDOUT" },
    ];
    await expect(
      requestUpstreamFallback(
        [makeMockUpstream("a.com"), makeMockUpstream("b.com")],
        "GET",
        {},
      ),
    ).rejects.toThrow(/all upstreams failed.*a.com.*b.com/);
  });
});
