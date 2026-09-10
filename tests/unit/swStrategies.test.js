/**
 * swStrategies.test.js — Service Worker 缓存策略函数单元测试
 *
 * 覆盖 src/swStrategies.js 的所有导出：
 *   - isModelRequest / isAppChunkRequest：URL 路由
 *   - pickStrategy：决策正确性
 *   - cacheFirst / staleWhileRevalidate / networkFirstWithCacheFallback：三种策略
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isModelRequest,
  isAppChunkRequest,
  pickStrategy,
  cacheFirst,
  staleWhileRevalidate,
  networkFirstWithCacheFallback,
} from "../../src/swStrategies.js";

// ---------- mock Cache Storage ----------
class MockCache {
  constructor() { this.store = new Map(); }
  async match(req) {
    if (!req) return undefined;
    const key = typeof req === "string" ? req : req.url;
    return this.store.get(key);
  }
  async put(req, res) {
    const key = typeof req === "string" ? req : req.url;
    this.store.set(key, res);
  }
  async add(url) { this.store.set(url, new Response("cached")); }
  async keys() { return [...this.store.keys()]; }
  async delete(req) {
    const key = typeof req === "string" ? req : req.url;
    return this.store.delete(key);
  }
}

class MockCaches {
  constructor() { this.caches = new Map(); }
  async open(name) {
    if (!this.caches.has(name)) this.caches.set(name, new MockCache());
    return this.caches.get(name);
  }
  async keys() { return [...this.caches.keys()]; }
  async delete(name) { return this.caches.delete(name); }
  async has(name) { return this.caches.has(name); }
}

const mockCaches = new MockCaches();
const mockCacheName = "test-cache";

// ---------- mock fetch ----------
function mockFetchImpl(handler) {
  return vi.fn(async (req) => {
    if (handler) return handler(req);
    return new Response("network response", { status: 200 });
  });
}

const req = (url) => ({ url, method: "GET" });
const ok = (body = "ok") => new Response(body, { status: 200 });
const bad = () => new Response("bad", { status: 500 });

// ============================================================
// URL 路由判断
// ============================================================

describe("isModelRequest — 模型权重 URL 判定", () => {
  it("/hf/* 命中", () => {
    expect(isModelRequest(new URL("http://x/hf/Qwen/Qwen3-5/config.json"))).toBe(true);
  });
  it("/hf-transformers/* 命中", () => {
    expect(isModelRequest(new URL("http://x/hf-transformers/owner/repo/model.onnx"))).toBe(true);
  });
  it("/gh-raw/* 命中", () => {
    expect(isModelRequest(new URL("http://x/gh-raw/mlc-ai/binary-mlc-llm-libs/main/wasm/x.wasm"))).toBe(true);
  });
  it("其他路径不命中", () => {
    expect(isModelRequest(new URL("http://x/index.html"))).toBe(false);
    expect(isModelRequest(new URL("http://x/dist-embed/local-agent.esm.js"))).toBe(false);
    expect(isModelRequest(new URL("http://x/assets/foo.js"))).toBe(false);
  });
  it("空 URL / 无 pathname 安全降级", () => {
    expect(isModelRequest(null)).toBe(false);
    expect(isModelRequest(undefined)).toBe(false);
    expect(isModelRequest({})).toBe(false);
  });
});

describe("isAppChunkRequest — 应用 chunk URL 判定", () => {
  it("/assets/* 命中", () => {
    expect(isAppChunkRequest(new URL("http://x/assets/index-abc.js"))).toBe(true);
  });
  it("/dist-embed/* 命中", () => {
    expect(isAppChunkRequest(new URL("http://x/dist-embed/local-agent.esm.js"))).toBe(true);
    expect(isAppChunkRequest(new URL("http://x/dist-embed/index-CRTSj85G.js"))).toBe(true);
  });
  it("含 local-agent.esm.js 的 URL 命中（兼容 hash 路径）", () => {
    expect(isAppChunkRequest(new URL("http://x/cdn/local-agent.esm.js?hash=123"))).toBe(true);
  });
  it("模型权重 URL 不命中（防止误判）", () => {
    expect(isAppChunkRequest(new URL("http://x/hf/foo/bar"))).toBe(false);
  });
  it("其他路径不命中", () => {
    expect(isAppChunkRequest(new URL("http://x/index.html"))).toBe(false);
    expect(isAppChunkRequest(new URL("http://x/api/chat"))).toBe(false);
  });
});

describe("pickStrategy — 路由决策", () => {
  it("模型权重 → cacheFirst", () => {
    expect(pickStrategy(new URL("http://x/hf/x/y"), "cors")).toBe("cacheFirst");
  });
  it("应用 chunks → staleWhileRevalidate", () => {
    expect(pickStrategy(new URL("http://x/assets/x.js"), "cors")).toBe("staleWhileRevalidate");
    expect(pickStrategy(new URL("http://x/dist-embed/local-agent.esm.js"), "cors")).toBe("staleWhileRevalidate");
  });
  it("导航请求 → networkFirstWithCacheFallback", () => {
    expect(pickStrategy(new URL("http://x/some-page"), "navigate")).toBe("networkFirstWithCacheFallback");
  });
  it("其他 → null（不拦截）", () => {
    expect(pickStrategy(new URL("http://x/api/chat"), "cors")).toBe(null);
  });
});

// ============================================================
// cacheFirst 策略
// ============================================================

describe("cacheFirst — 缓存优先", () => {
  beforeEach(() => {
    mockCaches.caches.clear();
  });

  it("缓存命中 → 直接返回缓存，不走网络", async () => {
    const cache = await mockCaches.open(mockCacheName);
    const cachedRes = ok("from cache");
    await cache.put(req("http://x/hf/model"), cachedRes);
    const fetchImpl = mockFetchImpl(() => ok("from network"));
    const res = await cacheFirst(req("http://x/hf/model"), mockCacheName, mockCaches, fetchImpl);
    expect(await res.text()).toBe("from cache");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("缓存未命中 → 走网络，成功则写入缓存", async () => {
    const fetchImpl = mockFetchImpl(() => ok("from network"));
    const res = await cacheFirst(req("http://x/hf/model"), mockCacheName, mockCaches, fetchImpl);
    expect(await res.text()).toBe("from network");
    const cache = await mockCaches.open(mockCacheName);
    const cached = await cache.match(req("http://x/hf/model"));
    expect(cached).toBeDefined();
    expect(await cached.text()).toBe("from network");
  });

  it("缓存未命中 + 网络失败 → 返回 503", async () => {
    const fetchImpl = mockFetchImpl(() => {
      throw new Error("network down");
    });
    const res = await cacheFirst(req("http://x/hf/model"), mockCacheName, mockCaches, fetchImpl);
    expect(res.status).toBe(503);
  });

  it("缓存未命中 + 网络返回 5xx → 不写入缓存（避免缓存错误响应）", async () => {
    const fetchImpl = mockFetchImpl(() => bad());
    const res = await cacheFirst(req("http://x/hf/model"), mockCacheName, mockCaches, fetchImpl);
    expect(res.status).toBe(500);
    const cache = await mockCaches.open(mockCacheName);
    expect(await cache.match(req("http://x/hf/model"))).toBeUndefined();
  });
});

// ============================================================
// staleWhileRevalidate 策略
// ============================================================

describe("staleWhileRevalidate — 后台更新", () => {
  beforeEach(() => {
    mockCaches.caches.clear();
  });

  it("缓存命中 → 立即返回缓存 + 后台刷新", async () => {
    const cache = await mockCaches.open(mockCacheName);
    await cache.put(req("http://x/assets/x.js"), ok("cached"));
    const fetchImpl = mockFetchImpl(() => ok("fresh"));
    const res = await staleWhileRevalidate(req("http://x/assets/x.js"), mockCacheName, mockCaches, fetchImpl);
    expect(await res.text()).toBe("cached");
    // 等后台刷新完成
    await new Promise((r) => setTimeout(r, 10));
    const updated = await cache.match(req("http://x/assets/x.js"));
    expect(await updated.text()).toBe("fresh");
  });

  it("缓存未命中 → 走网络，成功则返回并缓存", async () => {
    const fetchImpl = mockFetchImpl(() => ok("fresh"));
    const res = await staleWhileRevalidate(req("http://x/assets/x.js"), mockCacheName, mockCaches, fetchImpl);
    expect(await res.text()).toBe("fresh");
    const cache = await mockCaches.open(mockCacheName);
    expect(await cache.match(req("http://x/assets/x.js"))).toBeDefined();
  });

  it("缓存未命中 + 网络失败 → 返回 504", async () => {
    const fetchImpl = mockFetchImpl(() => {
      throw new Error("offline");
    });
    const res = await staleWhileRevalidate(req("http://x/assets/x.js"), mockCacheName, mockCaches, fetchImpl);
    expect(res.status).toBe(504);
  });

  it("缓存命中 + 网络失败 → 仍能返回缓存（不阻塞）", async () => {
    const cache = await mockCaches.open(mockCacheName);
    await cache.put(req("http://x/assets/x.js"), ok("cached"));
    const fetchImpl = mockFetchImpl(() => {
      throw new Error("offline");
    });
    const res = await staleWhileRevalidate(req("http://x/assets/x.js"), mockCacheName, mockCaches, fetchImpl);
    expect(await res.text()).toBe("cached"); // 缓存兜底
  });
});

// ============================================================
// networkFirstWithCacheFallback 策略
// ============================================================

describe("networkFirstWithCacheFallback — 网络优先", () => {
  beforeEach(() => {
    mockCaches.caches.clear();
  });

  it("网络成功 → 返回网络响应并缓存", async () => {
    const fetchImpl = mockFetchImpl(() => ok("from network"));
    const res = await networkFirstWithCacheFallback(
      req("http://x/some-page"),
      mockCacheName,
      mockCaches,
      "/index.html",
      fetchImpl,
    );
    expect(await res.text()).toBe("from network");
    const cache = await mockCaches.open(mockCacheName);
    expect(await cache.match(req("http://x/some-page"))).toBeDefined();
  });

  it("网络失败 + 缓存命中 → 返回缓存", async () => {
    const cache = await mockCaches.open(mockCacheName);
    await cache.put(req("http://x/some-page"), ok("cached"));
    const fetchImpl = mockFetchImpl(() => {
      throw new Error("offline");
    });
    const res = await networkFirstWithCacheFallback(
      req("http://x/some-page"),
      mockCacheName,
      mockCaches,
      "/index.html",
      fetchImpl,
    );
    expect(await res.text()).toBe("cached");
  });

  it("网络失败 + 缓存未命中 + fallbackUrl 命中 → 返回 fallback（index.html）", async () => {
    const cache = await mockCaches.open(mockCacheName);
    await cache.put(req("/index.html"), ok("app shell"));
    const fetchImpl = mockFetchImpl(() => {
      throw new Error("offline");
    });
    const res = await networkFirstWithCacheFallback(
      req("http://x/some-page"),
      mockCacheName,
      mockCaches,
      "/index.html",
      fetchImpl,
    );
    expect(await res.text()).toBe("app shell");
  });

  it("网络失败 + 缓存 + fallback 都没命中 → 返回 503", async () => {
    const fetchImpl = mockFetchImpl(() => {
      throw new Error("offline");
    });
    const res = await networkFirstWithCacheFallback(
      req("http://x/some-page"),
      mockCacheName,
      mockCaches,
      "/index.html",
      fetchImpl,
    );
    expect(res.status).toBe(503);
  });

  it("fallbackUrl 可自定义", async () => {
    const fetchImpl = mockFetchImpl(() => {
      throw new Error("offline");
    });
    // 没设置 fallback，缓存也空 → 503
    const res = await networkFirstWithCacheFallback(
      req("http://x/some-page"),
      mockCacheName,
      mockCaches,
      "/custom.html",
      fetchImpl,
    );
    expect(res.status).toBe(503);
  });
});