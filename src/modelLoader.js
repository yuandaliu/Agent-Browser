/**
 * modelLoader.js — 模型加载引擎
 *
 * 封装 @missionsquad/browserai 的模型加载：
 *   - 加载前探测 WebGPU（本地小模型推理的硬性要求）
 *   - 订阅 loadprogress / status / modelloaded 事件，向 UI 输出 0-100 进度与状态文本
 *   - 加载完成后输出控制台日志「模型已就绪」
 *
 * 模型元数据（MODEL_OPTIONS）：每个选项含 tier / sizeMB / minVRAMGB / minCores / recommended
 * 字段，recommendModelId() 根据硬件能力自适应推荐默认档。
 *
 * createModelLoader({ browserAI, onEvent }) → { load, unload, isBusy, getModelId }
 * onEvent: ({ type: 'progress'|'status'|'ready'|'error'|'hardware', ... }) => void
 */

const MODEL_OPTIONS = [
  {
    id: "Qwen3.5-0.8B-q4f16_1-MLC",
    label: "Qwen3.5 0.8B（低门槛，~447MB / 1.6GB 显存）",
    tier: "low",
    sizeMB: 447,
    minVRAMGB: 1.6,
    minCores: 2,
    recommended: false,
    description: "速度优先，能力受限，适合老旧设备",
  },
  {
    id: "gemma3-1b-it-q4f16_1-MLC",
    label: "Gemma 3 1B（最低显存，~580MB / 711MB 显存）",
    tier: "low",
    sizeMB: 580,
    minVRAMGB: 0.8,
    minCores: 2,
    recommended: false,
    description: "显存门槛最低的兜底档，中文能力弱于 Qwen",
  },
  {
    id: "Qwen3.5-2B-q4f16_1-MLC",
    label: "Qwen3.5 2B（轻量，~1.2GB / 2.2GB 显存）",
    tier: "mid",
    sizeMB: 1200,
    minVRAMGB: 2.2,
    minCores: 4,
    recommended: false,
    description: "入门级 2B，速度与能力初步平衡",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B（推荐，~1.8GB / 4GB 显存）",
    tier: "high",
    sizeMB: 1800,
    minVRAMGB: 4,
    minCores: 4,
    recommended: true,
    description: "速度与能力平衡，主流 PC 推荐档",
  },
  {
    id: "Hermes-3-Llama-3.2-3B-q4f16_1-MLC",
    label: "Hermes 3 Llama 3B（结构化输出更稳，~1.8GB / 2.2GB 显存）",
    tier: "high",
    sizeMB: 1800,
    minVRAMGB: 2.2,
    minCores: 4,
    recommended: false,
    description: "Hermes 调优版，工具调用/JSON 输出更稳定",
  },
  {
    id: "Qwen3.5-4B-q4f16_1-MLC",
    label: "Qwen3.5 4B（高质量，~2.4GB / 6GB 显存）",
    tier: "ultra",
    sizeMB: 2400,
    minVRAMGB: 6,
    minCores: 8,
    recommended: false,
    description: "高质量档，需 6GB+ 显存",
  },
];

// 同步 fallback：probeHardware 之前的兜底默认（最低档，确保任意设备都能加载）
const FALLBACK_MODEL_ID = MODEL_OPTIONS.find((m) => m.tier === "low").id;

/**
 * 获取全部模型选项（含元数据）。
 * 返回浅拷贝防止外部 mutation 污染内部常量。
 */
export function getModelOptions() {
  return MODEL_OPTIONS.map((m) => ({ ...m }));
}

/**
 * 同步获取默认模型 ID。仅在 probeHardware 之前 / 不能异步的场景下使用；
 * 真实使用请用 getDefaultModelIdAsync(snapshot) 或 recommendModelId(snapshot)。
 */
export function getDefaultModelId() {
  return FALLBACK_MODEL_ID;
}

/**
 * 根据硬件能力推荐最合适的模型 ID。
 *
 * 决策逻辑（保守偏低端，确保不会选到跑不动的档）：
 *   1. 不支持 WebGPU → low
 *   2. 4 核以下   → low
 *   3. 4 核（含 navigator.hardwareConcurrency 启发式）→ 推荐 "high" 中带 recommended 标记的（Llama 3.2 3B）
 *   4. 8 核及以上 → ultra（4B）
 *
 * @param {object} snapshot - 来自 ai.probeHardware() 的结果（含 webgpuSupported / webgpuReason 等）
 * @returns {string} 模型 ID（保证在 MODEL_OPTIONS 中存在）
 */
export function recommendModelId(snapshot) {
  // 1) 不支持 WebGPU → 最低档
  if (!snapshot?.webgpuSupported) {
    return findByTier("low")?.id ?? FALLBACK_MODEL_ID;
  }

  // 2) 启发式硬件能力（navigator.hardwareConcurrency 不可用时默认 4）
  const cores = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4;

  // 3) 决策候选档位（高 → 低）
  let tiers;
  if (cores >= 8) {
    tiers = ["ultra", "high", "mid", "low"];
  } else if (cores >= 4) {
    tiers = ["high", "mid", "low"];
  } else {
    tiers = ["low"];
  }

  // 4) 按 tier 优先级选：优先带 recommended 标记的，否则选该 tier 的第一个
  for (const tier of tiers) {
    const recommended = MODEL_OPTIONS.find((m) => m.tier === tier && m.recommended);
    if (recommended) return recommended.id;
  }
  for (const tier of tiers) {
    const any = MODEL_OPTIONS.find((m) => m.tier === tier);
    if (any) return any.id;
  }

  return FALLBACK_MODEL_ID;
}

/**
 * 异步获取默认模型 ID（async 形式，便于在 ready() 后调用）。
 * @param {object} snapshot - 来自 ai.probeHardware() 的结果
 * @returns {string} 推荐模型 ID
 */
export async function getDefaultModelIdAsync(snapshot) {
  return recommendModelId(snapshot);
}

/**
 * 用 SDK 实际模型目录（BrowserAI.presets）过滤 MODEL_OPTIONS。
 *
 * 背景：MODEL_OPTIONS 曾出现 SDK 目录中不存在的 id（Qwen2.5-1.5B / Qwen2.5-3B，
 * 选中即抛 UnknownModelError）。UI 构建下拉时应改用本函数，保证只展示真正可加载的档位。
 *
 * @param {readonly {id:string}[]} presets - BrowserAI.presets（或任何含 id 字段的对象数组）
 * @returns {object[]} 过滤后的选项（浅拷贝）；presets 为空/无交集时返回全部选项（降级，不阻断）
 */
export function getAvailableModelOptions(presets) {
  const ids = new Set((presets ?? []).map((p) => p?.id).filter(Boolean));
  if (ids.size === 0) return getModelOptions();
  const available = getModelOptions().filter((m) => ids.has(m.id));
  return available.length > 0 ? available : getModelOptions();
}

/**
 * 校验 modelId 是否在 SDK 目录中；不在时降级到最低可用档并 warn。
 * 作为 load() 的最终防线：即使调用方传入失效 id，也不会直接撞 UnknownModelError。
 */
function resolveLoadableModelId(modelId, browserAI) {
  const presets = browserAI?.presets ?? [];
  if (presets.length === 0 || presets.some((p) => p.id === modelId)) return modelId;
  const options = getAvailableModelOptions(presets);
  const fallback = options.find((m) => m.tier === "low")?.id ?? options[0]?.id ?? modelId;
  console.warn(`[model-loader] 模型 "${modelId}" 不在 SDK 目录中，已降级为 "${fallback}"`);
  return fallback;
}

// ---------------------------------------------------------------------------
// 模型加载引擎
// ---------------------------------------------------------------------------

export function createModelLoader({ browserAI, onEvent = () => {} }) {
  let loadedModelId = null;
  let busy = false;
  let lastProgress = 0;

  /** 监听 SDK 事件（一次性注册，避免重复订阅） */
  const offs = [
    browserAI.on("loadprogress", ({ progress, status, file, modelId }) => {
      if (typeof progress === "number" && Number.isFinite(progress)) {
        // 进度可能回退（不同下载阶段），UI 侧可自行做单调化
        lastProgress = Math.max(0, Math.min(1, progress));
        onEvent({ type: "progress", progress: lastProgress, status, file, modelId });
      } else {
        onEvent({ type: "progress", progress: lastProgress, status, file, modelId });
      }
    }),
    browserAI.on("status", ({ message }) => {
      onEvent({ type: "status", message });
      console.log(`[model-loader] ${message}`);
    }),
    browserAI.on("modelloaded", ({ model }) => {
      loadedModelId = model.modelId;
      busy = false;
      console.log(`✅ 模型已就绪: ${model.modelId}`);
      onEvent({ type: "ready", modelId: model.modelId });
    }),
    browserAI.on("modelunloaded", ({ modelId }) => {
      if (loadedModelId === modelId) loadedModelId = null;
      console.log(`[model-loader] 已卸载: ${modelId}`);
    }),
  ];

  async function checkHardware() {
    const snapshot = await browserAI.probeHardware();
    onEvent({ type: "hardware", snapshot });
    if (!snapshot.webgpuSupported) {
      throw new Error(
        `当前浏览器不支持 WebGPU（${snapshot.webgpuReason ?? "未知原因"}）。请使用最新版 Chrome / Edge 并开启硬件加速。`,
      );
    }
    return snapshot;
  }

  async function load(modelId = FALLBACK_MODEL_ID) {
    if (busy) throw new Error("已有加载任务正在进行");
    busy = true;
    lastProgress = 0;
    // 最终防线：失效 id（不在 SDK 目录）降级到最低可用档，而不是撞 UnknownModelError
    const targetId = resolveLoadableModelId(modelId, browserAI);
    onEvent({ type: "progress", progress: 0, status: "准备加载…", modelId: targetId });
    console.log(`[model-loader] 开始加载模型: ${targetId}`);
    try {
      await checkHardware();
      onEvent({ type: "status", message: `开始下载并加载 ${targetId}（首次加载需下载，之后走浏览器缓存）…` });
      await browserAI.load(targetId, {
        onProgress: ({ progress, status, file }) => {
          if (typeof progress === "number") {
            lastProgress = Math.max(0, Math.min(1, progress));
          }
          onEvent({ type: "progress", progress: lastProgress, status, file, modelId: targetId });
        },
      });
      busy = false; // 成功路径显式复位，摆脱对 SDK modelloaded 事件时序的隐式依赖
      return browserAI.textModel();
    } catch (err) {
      busy = false;
      console.error("[model-loader] 加载失败:", err);
      onEvent({ type: "error", error: err });
      throw err;
    }
  }

  async function unload() {
    if (browserAI.loadedModels.length > 0) {
      await browserAI.unloadAll();
    }
  }

  function isBusy() {
    return busy;
  }

  function getLoadedModelId() {
    return loadedModelId;
  }

  function dispose() {
    offs.forEach((off) => off());
  }

  return { load, unload, isBusy, getLoadedModelId, checkHardware, dispose };
}

// 内部 helper（不在 export 列表中，单元测试通过 recommendModelId 间接覆盖）
function findByTier(tier) {
  return MODEL_OPTIONS.find((m) => m.tier === tier);
}