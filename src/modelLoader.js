/**
 * modelLoader.js — 模型加载引擎
 *
 * 封装 @missionsquad/browserai 的模型加载：
 *   - 加载前探测 WebGPU（本地小模型推理的硬性要求）
 *   - 订阅 loadprogress / status / modelloaded 事件，向 UI 输出 0-100 进度与状态文本
 *   - 加载完成后输出控制台日志「模型已就绪」
 *
 * createModelLoader({ browserAI, onEvent }) → { load, unload, isBusy, getModelId }
 * onEvent: ({ type: 'progress'|'status'|'ready'|'error'|'hardware', ... }) => void
 */

const MODEL_OPTIONS = [
  { id: "Qwen3.5-0.8B-q4f16_1-MLC", label: "Qwen3.5 0.8B（低门槛，~447MB 下载 / 1.6GB 显存）" },
  { id: "Qwen/Qwen3.5-2B", label: "Qwen3.5 2B（平衡，~2.2GB 显存 / ~1GB 下载）" },
  { id: "Qwen3.5-4B-q4f16_1-MLC", label: "Qwen3.5 4B（高质量，~3.8GB 显存 / ~2.4GB 下载）" },
];

const DEFAULT_MODEL_ID = "Qwen3.5-0.8B-q4f16_1-MLC";

export function getModelOptions() {
  return MODEL_OPTIONS;
}

export function getDefaultModelId() {
  return DEFAULT_MODEL_ID;
}

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

  async function load(modelId = DEFAULT_MODEL_ID) {
    if (busy) throw new Error("已有加载任务正在进行");
    busy = true;
    lastProgress = 0;
    onEvent({ type: "progress", progress: 0, status: "准备加载…", modelId });
    console.log(`[model-loader] 开始加载模型: ${modelId}`);
    try {
      await checkHardware();
      onEvent({ type: "status", message: `开始下载并加载 ${modelId}（首次加载需下载，之后走浏览器缓存）…` });
      await browserAI.load(modelId, {
        onProgress: ({ progress, status, file }) => {
          if (typeof progress === "number") {
            lastProgress = Math.max(0, Math.min(1, progress));
          }
          onEvent({ type: "progress", progress: lastProgress, status, file, modelId });
        },
      });
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
