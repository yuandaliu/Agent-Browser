/**
 * modelLoader.test.js — 模型元数据与设备自适应推荐单元测试
 *
 * 覆盖：
 *   - MODEL_OPTIONS 结构（新加的 tier / sizeMB / minVRAMGB / minCores / recommended 字段）
 *   - getModelOptions 返回浅拷贝（防 mutation）
 *   - getDefaultModelId 返回同步 fallback
 *   - recommendModelId 在不同 snapshot 下的档位选择
 *   - getDefaultModelIdAsync 与 recommendModelId 行为一致
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  recommendModelId,
  getDefaultModelId,
  getDefaultModelIdAsync,
  getModelOptions,
  getAvailableModelOptions,
} from "../../src/modelLoader.js";
// SDK 真实模型目录（MODEL_PRESETS 由主入口 re-export，纯静态数据，Node 可直接导入）
import { MODEL_PRESETS } from "@missionsquad/browserai";

// mock navigator.hardwareConcurrency（node 环境无 navigator）
const originalNavigator = globalThis.navigator;
function setCores(n) {
  Object.defineProperty(globalThis, "navigator", {
    value: { hardwareConcurrency: n },
    configurable: true,
    writable: true,
  });
}
function restoreNavigator() {
  if (originalNavigator !== undefined) {
    Object.defineProperty(globalThis, "navigator", { value: originalNavigator, configurable: true, writable: true });
  } else {
    delete globalThis.navigator;
  }
}

describe("MODEL_OPTIONS — 模型元数据", () => {
  it("包含完整字段：id / label / tier / sizeMB / minVRAMGB / minCores / recommended / description", () => {
    const options = getModelOptions();
    expect(options.length).toBeGreaterThanOrEqual(3);
    for (const opt of options) {
      expect(opt).toHaveProperty("id");
      expect(opt).toHaveProperty("label");
      expect(opt).toHaveProperty("tier");
      expect(opt).toHaveProperty("sizeMB");
      expect(opt).toHaveProperty("minVRAMGB");
      expect(opt).toHaveProperty("minCores");
      expect(opt).toHaveProperty("recommended");
      expect(opt).toHaveProperty("description");
      expect(["low", "mid", "high", "ultra"]).toContain(opt.tier);
    }
  });

  it("恰好有一个 recommended: true 的选项", () => {
    const recommended = getModelOptions().filter((m) => m.recommended);
    expect(recommended.length).toBe(1);
  });

  it("getModelOptions 返回浅拷贝（mutation 不影响内部常量）", () => {
    const options1 = getModelOptions();
    options1[0].label = "HACKED";
    const options2 = getModelOptions();
    expect(options2[0].label).not.toBe("HACKED");
  });

  it("MODEL_OPTIONS 的每个 id 都存在于 SDK 真实目录（MODEL_PRESETS）中", () => {
    // 回归防护：曾出现 Qwen2.5-1.5B / Qwen2.5-3B 不在 SDK 目录、选中即 UnknownModelError 的问题。
    // SDK 升级/换模型后若目录变化，本测试会立即暴露失效条目。
    const catalogIds = new Set(MODEL_PRESETS.map((p) => p.id));
    for (const opt of getModelOptions()) {
      expect(catalogIds.has(opt.id)).toBe(true);
    }
  });
});

describe("getAvailableModelOptions — SDK 目录过滤", () => {
  it("过滤掉不在 SDK 目录中的选项", () => {
    const presets = [
      { id: "Qwen3.5-0.8B-q4f16_1-MLC" },
      { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC" },
    ];
    const available = getAvailableModelOptions(presets);
    expect(available.map((m) => m.id)).toEqual([
      "Qwen3.5-0.8B-q4f16_1-MLC",
      "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    ]);
  });

  it("presets 为空 / null 时降级返回全部选项（不阻断）", () => {
    expect(getAvailableModelOptions([])).toEqual(getModelOptions());
    expect(getAvailableModelOptions(null)).toEqual(getModelOptions());
    expect(getAvailableModelOptions(undefined)).toEqual(getModelOptions());
  });

  it("目录与 MODEL_OPTIONS 完全无交集时也降级返回全部（避免空下拉）", () => {
    const presets = [{ id: "some-unknown-model" }];
    expect(getAvailableModelOptions(presets)).toEqual(getModelOptions());
  });

  it("返回浅拷贝（mutation 不污染内部常量）", () => {
    const available = getAvailableModelOptions([{ id: "Qwen3.5-0.8B-q4f16_1-MLC" }]);
    available[0].label = "HACKED";
    expect(getModelOptions().find((m) => m.id === "Qwen3.5-0.8B-q4f16_1-MLC").label).not.toBe("HACKED");
  });
});

describe("getDefaultModelId — 同步 fallback", () => {
  it("返回最低档（low）的模型 ID", () => {
    const id = getDefaultModelId();
    const opt = getModelOptions().find((m) => m.id === id);
    expect(opt).toBeDefined();
    expect(opt.tier).toBe("low");
  });

  it("在 navigator 不可用时仍能返回（不抛错）", () => {
    restoreNavigator();
    expect(() => getDefaultModelId()).not.toThrow();
  });
});

describe("recommendModelId — 设备自适应推荐", () => {
  beforeEach(() => {
    setCores(4); // 默认 4 核
  });
  afterEach(() => {
    restoreNavigator();
  });

  it("不支持 WebGPU → 返回最低档", () => {
    const id = recommendModelId({ webgpuSupported: false });
    const opt = getModelOptions().find((m) => m.id === id);
    expect(opt.tier).toBe("low");
  });

  it("WebGPU 支持 + 8 核及以上 → 选带 recommended 标记的（Llama-3.2-3B）", () => {
    setCores(8);
    const id = recommendModelId({ webgpuSupported: true });
    expect(id).toBe("Llama-3.2-3B-Instruct-q4f16_1-MLC");
  });

  it("WebGPU 支持 + 16 核 → 优先 ultra（4B），无 ultra 才退回 high", () => {
    setCores(16);
    const id = recommendModelId({ webgpuSupported: true });
    const opt = getModelOptions().find((m) => m.id === id);
    expect(["ultra", "high"]).toContain(opt.tier);
    expect(opt.recommended).toBe(true); // 推荐档
  });

  it("WebGPU 支持 + 4 核 → high（3B 推荐档）", () => {
    setCores(4);
    const id = recommendModelId({ webgpuSupported: true });
    const opt = getModelOptions().find((m) => m.id === id);
    expect(opt.tier).toBe("high");
    expect(opt.recommended).toBe(true);
  });

  it("WebGPU 支持 + 2 核 → low（保守选择，避免卡顿）", () => {
    setCores(2);
    const id = recommendModelId({ webgpuSupported: true });
    const opt = getModelOptions().find((m) => m.id === id);
    expect(opt.tier).toBe("low");
  });

  it("snapshot 为 null/undefined → 兜底到最低档", () => {
    expect(() => recommendModelId(null)).not.toThrow();
    expect(() => recommendModelId(undefined)).not.toThrow();
    const id1 = recommendModelId(null);
    const id2 = recommendModelId(undefined);
    expect(getModelOptions().find((m) => m.id === id1).tier).toBe("low");
    expect(getModelOptions().find((m) => m.id === id2).tier).toBe("low");
  });

  it("navigator 不可用时也能安全运行", () => {
    restoreNavigator();
    expect(() => recommendModelId({ webgpuSupported: true })).not.toThrow();
    const id = recommendModelId({ webgpuSupported: true });
    expect(getModelOptions().some((m) => m.id === id)).toBe(true);
  });

  it("返回值始终在 MODEL_OPTIONS 中", () => {
    const ids = getModelOptions().map((m) => m.id);
    for (const cores of [1, 2, 4, 8, 16, 32]) {
      setCores(cores);
      const id = recommendModelId({ webgpuSupported: true });
      expect(ids).toContain(id);
    }
    const idNoGpu = recommendModelId({ webgpuSupported: false });
    expect(ids).toContain(idNoGpu);
  });
});

describe("getDefaultModelIdAsync — 异步接口", () => {
  it("返回值与 recommendModelId 一致（4 核场景）", async () => {
    setCores(4);
    const snapshot = { webgpuSupported: true };
    const syncId = recommendModelId(snapshot);
    const asyncId = await getDefaultModelIdAsync(snapshot);
    expect(asyncId).toBe(syncId);
  });

  it("snapshot 不支持 WebGPU 时返回 low", async () => {
    const id = await getDefaultModelIdAsync({ webgpuSupported: false });
    expect(getModelOptions().find((m) => m.id === id).tier).toBe("low");
  });
});