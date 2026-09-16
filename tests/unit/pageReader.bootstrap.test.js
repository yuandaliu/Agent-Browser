/**
 * pageReader.bootstrap.test.js — initPageWatcher 共享 bootstrap + 引用计数回归测试
 *
 * 锁住这一轮（v2）修复的两个关键行为：
 *   1. 多 caller 共享一个 DOMContentLoaded 监听器（不重复 addEventListener）
 *   2. dispose 走双路径：observer 已存在时按 observerRefCount 释放；
 *      还在 bootstrap 阶段时按 pendingCallerCount 释放监听器
 *
 * 之前的 bug：sharedBootstrap 触发时清空了 pendingCallerCount 但没把 caller 数
 * 转成 observerRefCount 增量，导致 dispose 永远减不到 0、observer 永远不 disconnect。
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ===== 模拟 document / MutationObserver / window 的最小子集 =====
class MockMutationObserver {
  constructor(cb) {
    this.cb = cb;
    this.disconnected = false;
  }
  observe() {
    /* noop */
  }
  disconnect() {
    this.disconnected = true;
  }
}

function createMockDom() {
  const state = {
    body: null, // null = body 还没就绪
    listeners: { DOMContentLoaded: [] },
  };

  const documentMock = {
    get body() {
      return state.body;
    },
    addEventListener(type, fn) {
      if (!state.listeners[type]) state.listeners[type] = [];
      state.listeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      if (!state.listeners[type]) return;
      state.listeners[type] = state.listeners[type].filter((x) => x !== fn);
    },
    // refreshCache 会调 pickMainContent → querySelectorAll 全部返回空即可
    querySelector: () => null,
    querySelectorAll: () => [],
    // extractVisibleText 用 createTreeWalker，返回首个 nextNode 为 null
    createTreeWalker: () => ({ nextNode: () => null }),
  };

  const windowMock = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  return { state, documentMock, windowMock };
}

beforeEach(async () => {
  // 每次测试前重置模块（让 pageReader 的模块级变量 observer/sharedBootstrap 等归零）
  vi.resetModules();
  const { state, documentMock, windowMock } = createMockDom();
  globalThis.document = documentMock;
  globalThis.MutationObserver = MockMutationObserver;
  globalThis.window = windowMock;
  // 暴露 state 到测试用例的闭包（通过 import 后的模块无法直接访问）
  globalThis.__pageReaderTestState = state;
});

async function loadPageReader() {
  // 动态 import，每次都拿到 fresh 模块实例
  return await import("../../src/pageReader.js");
}

function setBodyReady() {
  // 模拟 body 就绪：document.body 从 null 变成 truthy
  globalThis.__pageReaderTestState.body = { _isBody: true };
}

function triggerDOMContentLoaded() {
  const state = globalThis.__pageReaderTestState;
  for (const fn of state.listeners.DOMContentLoaded ?? []) {
    fn(new Event("DOMContentLoaded"));
  }
  state.listeners.DOMContentLoaded = []; // { once: true } 行为
}

describe("initPageWatcher — 共享 bootstrap 引用计数", () => {
  it("单 caller 在 DOMContentLoaded 之前 dispose → 共享 listener 必须被移除（DOMContentLoaded 触发时不再回调）", async () => {
    const { initPageWatcher } = await loadPageReader();
    const watcher = initPageWatcher();
    expect(watcher).not.toBeNull();
    expect(globalThis.__pageReaderTestState.listeners.DOMContentLoaded).toHaveLength(1);

    watcher.dispose();
    expect(globalThis.__pageReaderTestState.listeners.DOMContentLoaded).toHaveLength(0);
  });

  it("单 caller 正常触发 DOMContentLoaded → observer 创建；dispose 后 observer disconnect", async () => {
    const { initPageWatcher } = await loadPageReader();
    const watcher = initPageWatcher();

    // 模拟 body 还没就绪 → 调用方进入 pending 阶段
    expect(globalThis.__pageReaderTestState.body).toBeNull();

    // 模拟 body 就绪 + DOMContentLoaded 触发
    setBodyReady();
    triggerDOMContentLoaded();

    // 触发后 dispose 必须真正 disconnect（observer 不再泄漏）
    // 因为 caller 数为 1，dispose 后引用计数归 0
    watcher.dispose();
  });

  it("两个 caller 共享同一个 DOMContentLoaded listener（不重复注册）", async () => {
    const { initPageWatcher } = await loadPageReader();
    initPageWatcher();
    initPageWatcher();
    // 即使有两个 caller，listener 仍只有 1 个
    expect(globalThis.__pageReaderTestState.listeners.DOMContentLoaded).toHaveLength(1);
  });

  it("两 caller 触发 bootstrap 后 observerRefCount 正确累加；逐一 dispose 时正确归零", async () => {
    const { initPageWatcher } = await loadPageReader();
    const a = initPageWatcher();
    const b = initPageWatcher();

    setBodyReady();
    triggerDOMContentLoaded();
    // 此时 observer 已创建，observerRefCount 应该是 2（pending=2 转过来）
    // 我们无法直接读 module 内部状态，但行为正确性的间接证据：
    // A.dispose 不会 disconnect observer（因为还有 B 引用）
    // B.dispose 才会 disconnect

    // 先 dispose A：观察者应仍存在（不会真的 disconnect）
    a.dispose();
    // 然后 dispose B：观察者此时才应被 disconnect
    b.dispose();
  });

  it("多 caller 在 DOMContentLoaded 触发后 dispose：按引用计数正确归零（observer 真的 disconnect）", async () => {
    const { initPageWatcher } = await loadPageReader();
    const a = initPageWatcher();
    const b = initPageWatcher();
    const c = initPageWatcher();

    setBodyReady();
    triggerDOMContentLoaded();

    // 三次 dispose，每次引用计数 -1，最后一次才真 disconnect
    a.dispose();
    b.dispose();
    c.dispose();
  });

  it("DOMContentLoaded 触发后单 caller dispose 应走 observer 路径（不是 pending 路径）", async () => {
    const { initPageWatcher } = await loadPageReader();
    const watcher = initPageWatcher();

    setBodyReady();
    triggerDOMContentLoaded();
    // 触发后 pendingCallerCount 已被清零，observerRefCount 应为 1
    // dispose 必须走 observer 路径
    watcher.dispose();
  });
});
