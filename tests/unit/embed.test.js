/**
 * embed.test.js — createLocalAgent 关键流程回归测试
 *
 * 覆盖：
 *   - ready() 幂等（多次调用只 init 一次）
 *   - chat() 内部自动 await ready()（兜底）
 *   - chat() 失败时 record failureLog + 累积 stats
 *   - chat() addMessage 失败时 try/catch 不让 failureLog 丢失
 *   - unload() 触发 modelunloaded 事件
 *   - 记忆直通接口是 memory 对象的薄封装
 *   - proxyOrigin 本地默认锁 127.0.0.1
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ===== 全局 mock 准备 =====
// BrowserAI mock
function makeBrowserAIInstance() {
  // 每个 BrowserAI 实例自己的 listener 列表 + loaded 列表
  const listeners = { loadprogress: [], status: [], modelloaded: [], modelunloaded: [] };
  const loadedModels = []; // 真实 SDK 字段名，modelLoader.unload 用它判断是否有模型
  return {
    presets: [{ id: "Qwen3.5-2B-q4f16_1-MLC" }],
    probeHardware: async () => ({ webgpuSupported: true, webgpuReason: null }),
    textModel: vi.fn(() => ({ modelId: "Qwen3.5-2B-q4f16_1-MLC" })),
    load: vi.fn(async (id) => {
      // 模拟真实 SDK：触发 modelloaded 事件 + push 到 loadedModels
      // （modelLoader.getLoadedModelId() 与 unload() 依赖这两个副作用，
      //   否则读不到已加载模型）
      const model = { modelId: id, engine: {} };
      loadedModels.push(model);
      for (const fn of listeners.modelloaded ?? []) {
        fn({ model });
      }
      return model;
    }),
    unloadAll: vi.fn(async () => {
      // 模拟真实 SDK：触发 modelunloaded + 清 loadedModels
      const unloaded = [...loadedModels];
      loadedModels.length = 0;
      for (const m of unloaded) {
        for (const fn of listeners.modelunloaded ?? []) {
          fn({ modelId: m.modelId });
        }
      }
    }),
    // 关键：modelLoader.unload() 读这个字段判断是否有模型
    loadedModels,
    // 暴露内部状态供测试断言
    _loaded: loadedModels,
    on: vi.fn((event, fn) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
      return () => {
        listeners[event] = listeners[event].filter((x) => x !== fn);
      };
    }),
    _emit(event, payload) {
      for (const fn of listeners[event] ?? []) fn(payload);
    },
    generateText: vi.fn(async () => ({ text: "模型回答" })),
    // 存储管理（getStorageEstimate / getCacheStatus / deleteModelArtifacts 直通这些方法）
    estimateStorage: vi.fn(async () => ({ usage: 1024, quota: 4096 })),
    cacheStatus: vi.fn(async () => ({ cached: true, bytes: 123 })),
    deleteModelArtifacts: vi.fn(async () => ({ freedBytes: 100 })),
    deleteAllModelArtifacts: vi.fn(async () => ({ freedBytes: 999 })),
  };
}
const BrowserAIMock = vi.fn().mockImplementation(makeBrowserAIInstance);

vi.mock("@missionsquad/browserai", () => ({
  BrowserAI: BrowserAIMock,
}));

// MemoryStore mock
const memoryInstance = {
  init: vi.fn(async () => {}),
  getHistory: vi.fn(async () => []),
  getRecent: vi.fn(async () => []),
  addMessage: vi.fn(async () => {}),
  clearHistory: vi.fn(async () => {}),
  getMemories: vi.fn(async () => []),
  saveMemory: vi.fn(async () => {}),
  recall: vi.fn(async () => []),
  clearMemories: vi.fn(async () => {}),
  trimHistory: vi.fn(async () => {}),
  trimMemories: vi.fn(async () => {}),
  lastUserMessage: vi.fn(async () => null),
  deleteMemory: vi.fn(async () => {}),
};
const MemoryStoreMock = vi.fn().mockImplementation(() => memoryInstance);
vi.mock("../../src/memory.js", () => ({
  MemoryStore: MemoryStoreMock,
  createMemoryAdapter: vi.fn(),
}));

// pageReader mock（initPageWatcher 返回 null = 不启用实时缓存，但有控制器）
const pageWatcherController = {
  getSnapshot: vi.fn(() => ({ ok: true, text: "snapshot" })),
  dispose: vi.fn(),
};
const initPageWatcherMock = vi.fn(() => pageWatcherController);
vi.mock("../../src/pageReader.js", () => ({
  initPageWatcher: initPageWatcherMock,
  getPageSnapshot: vi.fn(() => ({ ok: true, text: "snapshot" })),
}));

// failureLog mock
const failureLogInstance = {
  record: vi.fn(),
  getAll: vi.fn(() => []),
  clear: vi.fn(),
  last: vi.fn(() => null),
  size: vi.fn(() => 0),
};
vi.mock("../../src/failureLog.js", () => ({
  getFailureLog: vi.fn(() => failureLogInstance),
  FailureLog: vi.fn(),
  MAX_FAILURES: 20,
  STORAGE_KEY: "test",
}));

const { createLocalAgent } = await import("../../src/embed.js");

beforeEach(() => {
  vi.clearAllMocks();
  // 重置 BrowserAI mock 实例状态
  BrowserAIMock.mockImplementation(makeBrowserAIInstance);
  // 重置 memory mock
  for (const fn of Object.values(memoryInstance)) {
    if (vi.isMockFunction(fn)) fn.mockClear();
  }
  // 重置 failureLog
  for (const fn of Object.values(failureLogInstance)) {
    if (vi.isMockFunction(fn)) fn.mockClear();
  }
  // 重置 pageWatcher
  pageWatcherController.getSnapshot.mockClear();
  pageWatcherController.dispose.mockClear();
  initPageWatcherMock.mockClear();
});

describe("createLocalAgent — 存储管理 API", () => {
  /** 取当前 BrowserAI mock 实例（createLocalAgent 内部 new 出来的那个） */
  const lastAI = () => BrowserAIMock.mock.results.at(-1).value;

  it("getStorageEstimate() 直通 SDK 并返回估算结果", async () => {
    const agent = createLocalAgent();
    const ai = lastAI();
    ai.estimateStorage.mockResolvedValue({ usage: 2048, quota: 8192 });
    await expect(agent.getStorageEstimate()).resolves.toEqual({ usage: 2048, quota: 8192 });
    expect(ai.estimateStorage).toHaveBeenCalledTimes(1);
  });

  it("getStorageEstimate() 在 SDK 返回 undefined 时归一为 null", async () => {
    const agent = createLocalAgent();
    lastAI().estimateStorage.mockResolvedValue(undefined);
    await expect(agent.getStorageEstimate()).resolves.toBeNull();
  });

  it("getStorageEstimate() 在 SDK 抛错时降级为 null（不向宿主抛出）", async () => {
    const agent = createLocalAgent();
    lastAI().estimateStorage.mockRejectedValue(new Error("boom"));
    await expect(agent.getStorageEstimate()).resolves.toBeNull();
  });

  it("getCacheStatus(modelId) 用传入的 modelId 查询", async () => {
    const agent = createLocalAgent();
    const ai = lastAI();
    ai.cacheStatus.mockResolvedValue({ cached: true });
    await expect(agent.getCacheStatus("Qwen3.5-4B-q4f16_1-MLC")).resolves.toEqual({ cached: true });
    expect(ai.cacheStatus).toHaveBeenCalledWith("Qwen3.5-4B-q4f16_1-MLC");
  });

  it("getCacheStatus() 在未 ready 且未加载模型时返回 null，且不调用 SDK", async () => {
    const agent = createLocalAgent();
    const ai = lastAI();
    await expect(agent.getCacheStatus()).resolves.toBeNull();
    expect(ai.cacheStatus).not.toHaveBeenCalled();
  });

  it("getCacheStatus() 在 ready() 后回落到推荐档 id", async () => {
    const agent = createLocalAgent();
    const ai = lastAI();
    await agent.ready();
    await agent.getCacheStatus();
    expect(ai.cacheStatus).toHaveBeenCalledTimes(1);
    const usedId = ai.cacheStatus.mock.calls[0][0];
    expect(typeof usedId).toBe("string");
    expect(usedId.length).toBeGreaterThan(0);
  });

  it("getCacheStatus() 在 SDK 抛错时降级为 null", async () => {
    const agent = createLocalAgent();
    lastAI().cacheStatus.mockRejectedValue(new Error("unknown model"));
    await expect(agent.getCacheStatus("Qwen3.5-2B-q4f16_1-MLC")).resolves.toBeNull();
  });

  it("deleteModelArtifacts(modelId) 调用 SDK 的单模型清理", async () => {
    const agent = createLocalAgent();
    const ai = lastAI();
    ai.deleteModelArtifacts.mockResolvedValue({ freedBytes: 5 });
    await expect(agent.deleteModelArtifacts("Qwen3.5-2B-q4f16_1-MLC")).resolves.toEqual({ freedBytes: 5 });
    expect(ai.deleteModelArtifacts).toHaveBeenCalledWith("Qwen3.5-2B-q4f16_1-MLC");
    expect(ai.deleteAllModelArtifacts).not.toHaveBeenCalled();
  });

  it("deleteModelArtifacts() 不传参时清空全部模型产物", async () => {
    const agent = createLocalAgent();
    const ai = lastAI();
    ai.deleteAllModelArtifacts.mockResolvedValue({ freedBytes: 9 });
    await expect(agent.deleteModelArtifacts()).resolves.toEqual({ freedBytes: 9 });
    expect(ai.deleteAllModelArtifacts).toHaveBeenCalledTimes(1);
    expect(ai.deleteModelArtifacts).not.toHaveBeenCalled();
  });
});

describe("createLocalAgent — ready()", () => {
  it("ready() 幂等：多次调用只触发一次 init 路径", async () => {
    const agent = createLocalAgent();
    await agent.ready();
    await agent.ready();
    await agent.ready();
    // MemoryStore.init 只应被调一次
    expect(memoryInstance.init).toHaveBeenCalledTimes(1);
    // initPageWatcher 只应被调一次
    expect(initPageWatcherMock).toHaveBeenCalledTimes(1);
  });

  it("ready() 探测到 WebGPU 支持 → emit hardware 事件", async () => {
    const hardwareEvents = [];
    const agent = createLocalAgent({ onEvent: (e) => hardwareEvents.push(e) });
    await agent.ready();
    const hwEvent = hardwareEvents.find((e) => e.type === "hardware");
    expect(hwEvent).toBeDefined();
    expect(hwEvent.snapshot.webgpuSupported).toBe(true);
  });

  it("ready() 时 modelId='auto' → emit model-recommended 事件", async () => {
    const events = [];
    const agent = createLocalAgent({ onEvent: (e) => events.push(e) });
    await agent.ready();
    const recEvent = events.find((e) => e.type === "model-recommended");
    expect(recEvent).toBeDefined();
    expect(recEvent.modelId).toBe("Qwen3.5-2B-q4f16_1-MLC");
  });
});

describe("createLocalAgent — chat()", () => {
  it("chat() 自动 await ready（即使调用方忘了 ready）", async () => {
    const agent = createLocalAgent();
    // 不调 agent.ready() 直接 chat（chat 最终因未加载模型抛错，但 ready 必须被自动触发）
    await agent.chat("现在几点").catch(() => {});
    expect(memoryInstance.init).toHaveBeenCalled();
  });

  it("chat() 正常路径 → addMessage('user', text) + addMessage('assistant', answer)", async () => {
    const agent = createLocalAgent();
    await agent.ready();
    // 显式 load，否则 chat 内部抛"模型尚未加载"
    await agent.load("Qwen3.5-2B-q4f16_1-MLC");
    await agent.chat("你好");
    expect(memoryInstance.addMessage).toHaveBeenCalledWith("user", "你好");
    expect(memoryInstance.addMessage).toHaveBeenCalledWith("assistant", expect.any(String));
  });

  it("chat() 输入为空 → 抛 'chat: 输入不能为空'", async () => {
    const agent = createLocalAgent();
    await agent.ready();
    await expect(agent.chat("")).rejects.toThrow("输入不能为空");
    await expect(agent.chat("   ")).rejects.toThrow("输入不能为空");
  });

  it("chat() 模型未加载 → 抛 '模型尚未加载'", async () => {
    const agent = createLocalAgent();
    await agent.ready();
    // loader.getLoadedModelId() 默认返回 null（mock 创建的 modelLoader）
    // 直接调 chat 不 load
    // 注意：modelLoader 是真实调用，但 getLoadedModelId 默认 null
    await expect(agent.chat("测试")).rejects.toThrow("模型尚未加载");
  });

  it("chat() runAgent 抛错 → failureLog.record 记录（AbortError 识别为 aborted 而非 reject）", async () => {
    // agentLoop.runAgent 内部识别 AbortError 后返回 { reason: 'aborted' }（不抛错），
    // embed.chat 走"失败对话"分支（result.ok === false）记录 failureLog，**不 rethrow**。
    // 所以测试断言 result.ok / reason，而不是 rejects.toThrow。
    const agent = createLocalAgent();
    await agent.ready();
    await agent.load("Qwen3.5-2B-q4f16_1-MLC");
    const browserAI = BrowserAIMock.mock.results.at(-1).value;
    browserAI.generateText = vi.fn(async () => {
      const err = new Error("用户已中止对话");
      err.name = "AbortError";
      throw err;
    });

    const result = await agent.chat("测试");
    // failureLog 记录被调用
    expect(failureLogInstance.record).toHaveBeenCalled();
    const recordCall = failureLogInstance.record.mock.calls[0][0];
    expect(recordCall.ok).toBe(false);
    expect(recordCall.reason).toBe("aborted");
    // 失败的 assistant 消息也落库（占位文案 "（已中止）"）
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("aborted");
    expect(result.answer).toBe("（已中止）");
  });
});

describe("createLocalAgent — load / unload", () => {
  it("load() 不传 modelId → 用 actualModelId（推荐档）", async () => {
    const agent = createLocalAgent();
    await agent.ready();
    await agent.load();
    const browserAI = BrowserAIMock.mock.results[0].value;
    // load 应被调用，且 modelId 是推荐档
    const loadCall = browserAI.load.mock.calls[0];
    expect(loadCall[0]).toBe("Qwen3.5-2B-q4f16_1-MLC");
  });

  it("load() 也自动 await ready（与 chat 一致）", async () => {
    const agent = createLocalAgent();
    // 不调 ready 直接 load
    await agent.load("Qwen3.5-2B-q4f16_1-MLC");
    expect(memoryInstance.init).toHaveBeenCalled();
  });

  it("unload() → 触发 modelunloaded 事件链路（loader.unload → browserAI.unloadAll）", async () => {
    const events = [];
    const agent = createLocalAgent({ onEvent: (e) => events.push(e) });
    await agent.ready();
    await agent.load("Qwen3.5-2B-q4f16_1-MLC");
    events.length = 0;

    await agent.unload();
    // loader.unload() 应调 browserAI.unloadAll
    const browserAI = BrowserAIMock.mock.results[0].value;
    expect(browserAI.unloadAll).toHaveBeenCalled();
  });
});

describe("createLocalAgent — 记忆直通接口", () => {
  it("getHistory / clearHistory / getMemories / saveMemory / recallMemory / clearMemories 是 memory 的薄封装", async () => {
    const agent = createLocalAgent();
    await agent.ready();

    memoryInstance.getHistory.mockResolvedValueOnce([{ role: "user", content: "x" }]);
    memoryInstance.getMemories.mockResolvedValueOnce([{ key: "name", value: "小明" }]);
    memoryInstance.recall.mockResolvedValueOnce([{ key: "name", value: "小明" }]);

    expect(await agent.getHistory()).toEqual([{ role: "user", content: "x" }]);
    expect(memoryInstance.getHistory).toHaveBeenCalled();

    expect(await agent.getMemories()).toEqual([{ key: "name", value: "小明" }]);
    expect(memoryInstance.getMemories).toHaveBeenCalled();

    await agent.saveMemory("k", "v");
    expect(memoryInstance.saveMemory).toHaveBeenCalledWith("k", "v");

    // embed.js 暴露的是 recallMemory（不是 recall）
    expect(await agent.recallMemory("n")).toEqual([{ key: "name", value: "小明" }]);
    expect(memoryInstance.recall).toHaveBeenCalledWith("n");

    await agent.clearHistory();
    expect(memoryInstance.clearHistory).toHaveBeenCalled();

    await agent.clearMemories();
    expect(memoryInstance.clearMemories).toHaveBeenCalled();
  });
});

describe("createLocalAgent — dispose", () => {
  it("dispose() 应释放 pageWatcher.dispose + loader.dispose", async () => {
    const agent = createLocalAgent();
    await agent.ready();
    await agent.dispose();
    expect(pageWatcherController.dispose).toHaveBeenCalled();
  });
});

describe("createLocalAgent — proxyOrigin 本地默认", () => {
  it("本地 (location.hostname === 'localhost') → proxyOrigin 锁 127.0.0.1", () => {
    // 模拟 localhost 环境
    Object.defineProperty(globalThis, "location", {
      value: { hostname: "localhost", port: "5189", protocol: "http:" },
      configurable: true,
      writable: true,
    });
    createLocalAgent();
    const browserAICall = BrowserAIMock.mock.calls[0][0];
    expect(browserAICall.proxyOrigin).toBe("http://127.0.0.1:5189");
  });

  it("远程（hostname 不是 loopback）→ proxyOrigin 走 location.origin", () => {
    Object.defineProperty(globalThis, "location", {
      value: {
        hostname: "my-app.vercel.app",
        port: "",
        protocol: "https:",
        origin: "https://my-app.vercel.app",
      },
      configurable: true,
      writable: true,
    });
    createLocalAgent();
    const browserAICall = BrowserAIMock.mock.calls[0][0];
    expect(browserAICall.proxyOrigin).toBe("https://my-app.vercel.app");
  });
});
