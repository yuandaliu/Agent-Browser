/**
 * modelLoader.createModelLoader.test.js — createModelLoader 核心方法回归测试
 *
 * 覆盖：
 *   - load() 成功路径 → emit { type: "ready", modelId }
 *   - load() 失败路径 → emit { type: "error", error } + busy 复位
 *   - load(invalidId) → resolveLoadableModelId 降级到 low 档
 *   - unload() → emit { type: "modelunloaded", modelId }
 *   - busy 状态机：已有 load 时再 load 抛错
 *   - dispose() 移除所有 SDK 事件订阅
 *   - getLoadedModelId() 反映 unload 后的状态
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createModelLoader, getModelOptions } from "../../src/modelLoader.js";

// ===== Mock browserAI =====
function makeBrowserAI(overrides = {}) {
  const listeners = {
    loadprogress: [],
    status: [],
    modelloaded: [],
    modelunloaded: [],
  };
  return {
    presets: [
      { id: "Qwen3.5-0.8B-q4f16_1-MLC" },
      { id: "Qwen3.5-2B-q4f16_1-MLC" },
      { id: "Qwen3.5-4B-q4f16_1-MLC" },
    ],
    on(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
      // 返回 unsubscribe 函数
      return () => {
        listeners[event] = listeners[event].filter((x) => x !== fn);
      };
    },
    _emit(event, payload) {
      for (const fn of listeners[event] ?? []) fn(payload);
    },
    _loaded: [],
    loadedModels: [],
    async probeHardware() {
      return { webgpuSupported: true, webgpuReason: null };
    },
    async load(modelId, opts) {
      // 默认模拟成功：模拟 SDK 异步 load 完成
      if (overrides.loadThrows) {
        throw overrides.loadThrows;
      }
      // 模拟 onProgress 回调（0→1）
      if (opts?.onProgress) {
        opts.onProgress({ progress: 0.5, status: "loading", file: "config.json" });
        opts.onProgress({ progress: 1, status: "done", file: "weights" });
      }
      // 触发 modelloaded 事件
      const model = { modelId, engine: {} };
      this._loaded.push(model);
      this.loadedModels.push(model);
      this._emit("modelloaded", { model });
      return model;
    },
    async unloadAll() {
      const unloaded = [...this._loaded];
      this._loaded = [];
      this.loadedModels = [];
      for (const m of unloaded) {
        this._emit("modelunloaded", { modelId: m.modelId });
      }
    },
    textModel() {
      return this._loaded[0] ?? null;
    },
    ...overrides,
  };
}

let browserAI;
let events;
let loader;

beforeEach(() => {
  events = [];
  browserAI = makeBrowserAI();
  loader = createModelLoader({ browserAI, onEvent: (e) => events.push(e) });
});

describe("createModelLoader — load 成功路径", () => {
  it("load(id) 成功 → emit ready 事件 + 返回 textModel()", async () => {
    const result = await loader.load("Qwen3.5-2B-q4f16_1-MLC");
    const readyEvent = events.find((e) => e.type === "ready");
    expect(readyEvent).toBeDefined();
    expect(readyEvent.modelId).toBe("Qwen3.5-2B-q4f16_1-MLC");
    expect(result).not.toBeNull();
    expect(loader.getLoadedModelId()).toBe("Qwen3.5-2B-q4f16_1-MLC");
  });

  it("load 过程 emit 多个 progress 事件（包含 status / file）", async () => {
    await loader.load("Qwen3.5-0.8B-q4f16_1-MLC");
    const progressEvents = events.filter((e) => e.type === "progress");
    expect(progressEvents.length).toBeGreaterThan(0);
    // 至少有一个 progress 事件带 file 字段
    expect(progressEvents.some((e) => e.file)).toBe(true);
    // 最后进度应为 1
    expect(progressEvents[progressEvents.length - 1].progress).toBe(1);
  });

  it("load() 不传 modelId → 用 FALLBACK_MODEL_ID（low 档：Qwen3.5-0.8B）", async () => {
    await loader.load();
    expect(loader.getLoadedModelId()).toBe("Qwen3.5-0.8B-q4f16_1-MLC");
  });
});

describe("createModelLoader — load 失败路径", () => {
  it("load 抛错 → emit error 事件 + busy 复位（后续 load 可重新触发）", async () => {
    // 用 vi.spyOn 在第一次调时抛错，第二次调时回到原始 mock 行为（成功）。
    // 注意不能走 overrides.loadThrows 或直接改 browserAI.loadThrows：
    //   - spread `...overrides` 不会覆盖 makeBrowserAI 里的 async load 实现，
    //     但 `if (overrides.loadThrows)` 闭包能读到 overrides
    //   - 直接改 `browserAI.loadThrows` 只动实例属性，闭包里的 overrides 不变，
    //     第二次 load 仍抛错并触发 unhandled rejection
    const spy = vi.spyOn(browserAI, "load");
    spy.mockImplementationOnce(async () => {
      throw new Error("下载失败");
    });
    loader = createModelLoader({ browserAI, onEvent: (e) => events.push(e) });

    await expect(loader.load("Qwen3.5-2B-q4f16_1-MLC")).rejects.toThrow("下载失败");
    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent.error.message).toBe("下载失败");

    // busy 状态必须复位：第二次 load 走原始 mock 行为（成功）
    events.length = 0;
    await loader.load("Qwen3.5-0.8B-q4f16_1-MLC");
    expect(events.some((e) => e.type === "ready")).toBe(true);
  });

  it("load(invalidId 不在 SDK 目录) → 降级到 low 档 + warn", async () => {
    // console.warn spy
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await loader.load("not-in-presets");
    // 应降级到 low 档
    expect(loader.getLoadedModelId()).toBe("Qwen3.5-0.8B-q4f16_1-MLC");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("已有 load 任务时再调 load → 抛 '已有加载任务正在进行'", async () => {
    // 让第一次 load 永远不结束
    browserAI.load = () => new Promise(() => {}); // 永不 resolve
    loader = createModelLoader({ browserAI, onEvent: () => {} });

    const first = loader.load("Qwen3.5-0.8B-q4f16_1-MLC");
    await expect(loader.load("Qwen3.5-2B-q4f16_1-MLC")).rejects.toThrow(
      "已有加载任务正在进行",
    );
    // 清理
    first.catch(() => {}); // 阻止 unhandled rejection
  });
});

describe("createModelLoader — unload 路径（锁住这一轮修复）", () => {
  it("unload() → emit modelunloaded 事件（关键修复）", async () => {
    await loader.load("Qwen3.5-2B-q4f16_1-MLC");
    events.length = 0; // 清空 load 阶段事件

    await loader.unload();
    const unloadedEvent = events.find((e) => e.type === "modelunloaded");
    expect(unloadedEvent).toBeDefined();
    expect(unloadedEvent.modelId).toBe("Qwen3.5-2B-q4f16_1-MLC");
  });

  it("unload 后 getLoadedModelId() 返回 null", async () => {
    await loader.load("Qwen3.5-2B-q4f16_1-MLC");
    expect(loader.getLoadedModelId()).toBe("Qwen3.5-2B-q4f16_1-MLC");
    await loader.unload();
    expect(loader.getLoadedModelId()).toBeNull();
  });

  it("unload 在空载时是 noop（不抛错）", async () => {
    await expect(loader.unload()).resolves.toBeUndefined();
    expect(events.filter((e) => e.type === "modelunloaded")).toHaveLength(0);
  });
});

describe("createModelLoader — busy 状态", () => {
  it("load 期间 isBusy() === true", async () => {
    let resolveLoad;
    // 直接替换 browserAI.load 为可控 Promise，绕开 vi.fn() 的不可变限制
    browserAI.load = () =>
      new Promise((resolve) => {
        resolveLoad = resolve;
      });
    loader = createModelLoader({ browserAI, onEvent: () => {} });

    const p = loader.load("Qwen3.5-0.8B-q4f16_1-MLC");
    // 关键：等 microtask 跑完让 loader.load 同步执行到 await browserAI.load
    // （executor 同步执行 resolveLoad = resolve）。
    // 单个 await Promise.resolve() 不够（loader.load 内部 await checkHardware
    // 还要再让出一次 microtask），需要多次或 setTimeout(0)。
    await new Promise((r) => setTimeout(r, 0));
    expect(loader.isBusy()).toBe(true);
    expect(typeof resolveLoad).toBe("function");
    resolveLoad({ modelId: "Qwen3.5-0.8B-q4f16_1-MLC", engine: {} });
    await p;
    expect(loader.isBusy()).toBe(false);
  });
});

describe("createModelLoader — checkHardware", () => {
  it("WebGPU 支持 → 正常返回 snapshot + emit hardware 事件", async () => {
    const snap = await loader.checkHardware();
    expect(snap.webgpuSupported).toBe(true);
    const hardwareEvent = events.find((e) => e.type === "hardware");
    expect(hardwareEvent).toBeDefined();
  });

  it("WebGPU 不支持 → 抛 WebGPUUnavailableError（load 内部捕获并 emit error）", async () => {
    browserAI = makeBrowserAI({
      probeHardware: async () => ({ webgpuSupported: false, webgpuReason: "无适配器" }),
    });
    loader = createModelLoader({ browserAI, onEvent: (e) => events.push(e) });

    await expect(loader.checkHardware()).rejects.toThrow();
    expect(events.some((e) => e.type === "hardware")).toBe(true);
  });
});

describe("createModelLoader — dispose", () => {
  it("dispose() 后 SDK 事件不再触发 onEvent", async () => {
    await loader.load("Qwen3.5-0.8B-q4f16_1-MLC");
    loader.dispose();
    events.length = 0;

    // 触发 SDK 端事件，UI 不应收到
    browserAI._emit("modelloaded", { model: { modelId: "Qwen3.5-4B-q4f16_1-MLC" } });
    expect(events).toHaveLength(0);
  });
});
