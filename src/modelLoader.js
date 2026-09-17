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
 * 国内开源策略：只列出 @missionsquad/browserai SDK 目录里"国内开源"的 WebLLM 文本
 * 模型。当前 SDK 目录里满足条件的只有阿里 Qwen3.5 系列；Gemma / Llama / Hermes 等国外
 * 模型直接砍掉，避免触发对 huggingface.co 直连的下载路径。
 *
 * createModelLoader({ browserAI, onEvent }) → {
 *   load(modelId?)           // 加载指定模型（默认 FALLBACK_MODEL_ID），成功返回 textModel()
 *   unload()                 // 卸载所有已加载模型，释放显存/WebGPU 上下文
 *   isBusy()                 // 当前是否有加载任务正在进行
 *   getLoadedModelId()       // 返回当前已加载的模型 ID，未加载返回 null
 *   checkHardware()          // 探测 WebGPU + 核心数（不抛错，但不支持 WebGPU 会抛）
 *   dispose()                // 移除所有 SDK 事件订阅
 * }
 * onEvent: ({ type: 'progress'|'status'|'ready'|'error'|'hardware'|'modelunloaded', ... }) => void
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
    description: "速度优先，能力受限，适合老旧设备（最低显存兜底）",
  },
  {
    id: "Qwen3.5-2B-q4f16_1-MLC",
    label: "Qwen3.5 2B（推荐，~1.2GB / 2.2GB 显存）",
    tier: "high",
    sizeMB: 1200,
    minVRAMGB: 2.2,
    minCores: 4,
    recommended: true,
    description: "速度与中文/工具调用能力平衡，国内开源主流档（默认推荐）",
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

// 同步 fallback：probeHardware 之前的兜底默认（最低档，确保任意设备都能加载）。
// 找不到 "low" tier 时回退到第一项，再不行用空串（让 SDK 自行 UnknownModelError 报错）。
const FALLBACK_MODEL_ID =
  MODEL_OPTIONS.find((m) => m.tier === "low")?.id ?? MODEL_OPTIONS[0]?.id ?? "";

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
 *   1. 不支持 WebGPU → low 档
 *   2. 4 核以下       → low 档
 *   3. 4 核及以上     → 候选 ultra → high → low，优先带 recommended 标记的（Qwen3.5 2B）
 *   4. 8 核及以上     → 候选顺序不变，但 high 档有 recommended 时仍优先 high；
 *                       若想让高核机器直接上 ultra，可把 Qwen3.5-4B 也标 recommended。
 *
 * 注意：候选 tier 顺序是从 MODEL_OPTIONS 实际存在的 tier 动态推导的，
 * 不再硬编码 mid 这种可能不存在的 tier。删除/新增 tier 后无需改本函数。
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

  // 3) 按当前 MODEL_OPTIONS 实际存在的 tier 推导优先级（高 → 低）。
  //    避免硬编码 tier 字符串，MODEL_OPTIONS 增删 tier 后本函数自动适配。
  const existingTiers = new Set(MODEL_OPTIONS.map((m) => m.tier));
  const orderedTiers = ["ultra", "high", "low"].filter((t) => existingTiers.has(t));
  const tiers = cores >= 4 ? orderedTiers : ["low"].filter((t) => existingTiers.has(t));

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
 * 背景：MODEL_OPTIONS 与 SDK 目录脱节时会出现"选中即抛 UnknownModelError"的档位。
 * UI 构建下拉时应改用本函数，保证只展示真正可加载的档位。
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
      onEvent({ type: "modelunloaded", modelId });
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