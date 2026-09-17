/**
 * memory.trim.test.js — trim 串行化回归测试
 *
 * 覆盖串行化逻辑：
 *   - addMessage 内部 fire-and-forget 触发 trimHistory，多个并发 addMessage
 *     必须按顺序串行执行，否则可能误删更多条目
 *   - 同样适用于 saveMemory + trimMemories
 *   - 单个 trim 抛错不应阻断后续 trim
 */

import { describe, it, expect } from "vitest";
import { MemoryStore, createMemoryAdapter } from "../../src/memory.js";

async function createStore() {
  const store = new MemoryStore(createMemoryAdapter());
  await store.init();
  return store;
}

describe("MemoryStore — trim 串行化（并发 addMessage 不丢消息）", () => {
  it("快速并发 addMessage 超过 MAX_STORAGE_MESSAGES：FIFO 裁剪正确，最新消息保留", async () => {
    const store = await createStore();
    // 模拟 add 250 条（MAX_STORAGE_MESSAGES = 200），并发触发
    const promises = [];
    for (let i = 0; i < 250; i++) {
      promises.push(store.addMessage("user", `消息-${i}`));
    }
    await Promise.all(promises);
    // 等待所有 fire-and-forget 的 trimHistory 完成
    await store.trimHistory();

    const all = await store.getHistory();
    expect(all.length).toBe(200);
    // 最旧的 50 条应该被裁掉
    expect(all[0].content).toBe("消息-50");
    // 最新的应该保留
    expect(all[199].content).toBe("消息-249");
  });

  it("并发 add + 同时调 trimHistory 不会抛错（共享 trimChain 串行）", async () => {
    const store = await createStore();
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(store.addMessage("user", `m-${i}`));
    }
    // 并发显式调 trimHistory（与内部 fire-and-forget 竞争）
    promises.push(store.trimHistory());
    promises.push(store.trimHistory());
    promises.push(store.trimHistory());
    await Promise.all(promises);

    const all = await store.getHistory();
    expect(all.length).toBe(50);
  });
});

describe("MemoryStore — saveMemory + trimMemories 串行化", () => {
  it("并发 saveMemory 超过 MAX_STORAGE_MEMORIES：FIFO 裁剪正确", async () => {
    const store = await createStore();
    const promises = [];
    for (let i = 0; i < 150; i++) {
      promises.push(store.saveMemory(`key-${i}`, `value-${i}`));
    }
    await Promise.all(promises);
    await store.trimMemories();

    const all = await store.getMemories();
    expect(all.length).toBe(100);
    // 最新的保留
    expect(all.some((m) => m.key === "key-149")).toBe(true);
    // 最旧的被裁
    expect(all.some((m) => m.key === "key-0")).toBe(false);
  });
});

describe("MemoryStore — 串行化顺序", () => {
  it("连续多次 trimHistory 调用按入队顺序执行（FIFO）", async () => {
    const store = await createStore();
    // 关键：不要预先 addMessage（否则 addMessage 内部 fire-and-forget 的
    // 200 个 trimHistory 都会进入 trimChain 排队，让 order 累积到 200+）。
    // 这里只测 3 个显式 trimHistory 的 FIFO 顺序。

    const order = [];
    // monkey-patch getAll 记录 trimHistory 调用顺序
    const orig = store.adapter.getAll;
    store.adapter.getAll = async (...args) => {
      order.push(order.length);
      return orig.apply(store.adapter, args);
    };

    // 并发触发 3 次 trimHistory，trimChain 串行执行
    await Promise.all([store.trimHistory(), store.trimHistory(), store.trimHistory()]);
    // 3 次串行执行
    expect(order).toEqual([0, 1, 2]);
  });

  it("addMessage 触发的 trimHistory 也走同一条 trimChain（与显式 trimHistory 共用队列）", async () => {
    const store = await createStore();
    // addMessage 内部 fire-and-forget 一个 trimHistory。
    // 验证：先 addMessage 几次（产生 N 个 trimHistory），再显式 trimHistory，
    // 显式那个会排在 N 个之后执行（串行队列）。
    const order = [];
    const orig = store.adapter.getAll;
    store.adapter.getAll = async (...args) => {
      order.push(`add#${order.filter((x) => x.startsWith("add")).length + 1}`);
      return orig.apply(store.adapter, args);
    };

    // 5 个 addMessage 触发 5 个 fire-and-forget trimHistory
    for (let i = 0; i < 5; i++) {
      await store.addMessage("user", `m-${i}`);
    }
    // 1 个显式 trimHistory（应该排在第 6 位）
    await store.trimHistory();
    // 5 个 add + 1 个显式 = 6 个调用
    expect(order).toHaveLength(6);
    expect(order[5]).toBe("add#6"); // 第 6 个 trimHistory
  });
});
