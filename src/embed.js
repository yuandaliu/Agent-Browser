/**
 * embed.js — 嵌入式 API：把本地智能体作为一个可复用组件嵌入任意已有 Web 页面
 *
 * 与 UI 完全解耦：不绑定任何 DOM，所有输出通过回调（onProgress / onStatus / onReady /
 * onStep / onDelta）交给宿主页面自行渲染。核心能力：
 *
 *   const agent = createLocalAgent({ onProgress, onReady, onError });
 *   await agent.ready();          // 初始化（IndexedDB + 事件 + 硬件探测）
 *   await agent.load();           // 加载 1B 模型（进度回调 0-100）
 *   const { answer } = await agent.chat("现在几点", { onStep, onDelta });  // 对话
 *   await agent.clearHistory();   // 新对话
 *
 * 构建为单文件后（dist-embed/local-agent.*.js），宿主页面只需一个 <script> 或
 * 一次 import 即可使用，详见 INTEGRATION.md。
 */
import { BrowserAI } from "@missionsquad/browserai";
import { MemoryStore, createMemoryAdapter } from "./memory.js";
import { createModelLoader, getModelOptions, getDefaultModelId, getDefaultModelIdAsync, recommendModelId, getAvailableModelOptions } from "./modelLoader.js";
import { runAgent } from "./agentLoop.js";
import { initPageWatcher, getPageSnapshot } from "./pageReader.js";
import { getFailureLog as getFailureLogSingleton } from "./failureLog.js";

export { getModelOptions, getDefaultModelId, getDefaultModelIdAsync, recommendModelId, getAvailableModelOptions, BrowserAI, getPageSnapshot, initPageWatcher };
export { safeEvaluate } from "./tools.js";
export { getFailureLog, FailureLog, MAX_FAILURES } from "./failureLog.js";
export { getToolJsonSchema, getToolJsonSchemas, validateToolInput, getOpenAIToolsFormat } from "./toolSchemas.js";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

/**
 * 创建本地智能体实例。
 * @param {object} options
 * @param {string} [options.modelId="auto"] 模型 ID；传 "auto"（默认）则由 ready() 探测硬件后自动推荐档位
 * @param {"proxy"|"direct"} [options.modelSource="proxy"] 模型下载方式
 * @param {string} [options.proxyOrigin] 代理 origin，默认页面同源
 * @param {boolean} [options.verifyProxy] 是否探测代理健康（本地默认 true，托管默认 false）
 * @param {number} [options.maxSteps=5] ReAct 最大循环步数
 * @param {object} [options.memoryAdapter] 自定义记忆适配器（默认 IndexedDB）
 * @param {(e:{type:string, progress?:number, status?:string, file?:string, modelId?:string, message?:string, error?:Error})=>void} [options.onEvent]
 *        统一事件回调（progress / status / ready / hardware / error）
 * @param {(p:{progress:number, status?:string, file?:string, modelId?:string})=>void} [options.onProgress] 进度回调（0-1）
 * @param {(message:string)=>void} [options.onStatus] 状态文本回调
 * @param {({modelId:string})=>void} [options.onReady] 模型就绪回调
 * @param {(error:Error)=>void} [options.onError] 错误回调
 */
export function createLocalAgent(options = {}) {
  const {
    modelId = "auto", // 默认 "auto"，由 ready() 探测硬件后自动推荐档位
    modelSource = "proxy",
    proxyOrigin,
    verifyProxy,
    maxSteps = 5,
    memoryAdapter = null,
    onEvent,
    onProgress,
    onStatus,
    onReady,
    onError,
  } = options;

  // 实际生效的模型 ID（auto 由 ready() 决定，否则用用户指定）
  let actualModelId = modelId === "auto" ? null : modelId;

  const emit = (event) => {
    onEvent?.(event);
    switch (event.type) {
      case "progress":
        onProgress?.({ progress: event.progress, status: event.status, file: event.file, modelId: event.modelId });
        break;
      case "status":
        onStatus?.(event.message);
        break;
      case "ready":
        onReady?.({ modelId: event.modelId });
        break;
      case "error":
        onError?.(event.error);
        break;
    }
  };

  const isLocal =
    typeof location !== "undefined" && LOCAL_HOSTS.includes(location.hostname);

  const ai = new BrowserAI({
    modelSource,
    proxyOrigin,
    verifyProxy: verifyProxy ?? (modelSource === "proxy" ? isLocal : false),
    cacheBackend: "indexeddb",
    webllm: { logLevel: "INFO" },
  });

  let memory = memoryAdapter ? new MemoryStore(memoryAdapter) : new MemoryStore();
  const loader = createModelLoader({ browserAI: ai, onEvent: emit });
  const failureLog = getFailureLogSingleton();

  let initialized = false;
  let initPromise = null;
  let chatting = false;
  let pageWatcher = null;
  let swRegistration = null; // Service Worker registration（best-effort）
  const chatStats = []; // 累计每次 chat 的工具耗时、首 token 延迟等指标（供 getStats 暴露给宿主）

  /** 初始化：打开 IndexedDB（失败降级内存适配器）、订阅事件、探测硬件、启动页面实时监听。可重复调用。 */
  async function ready() {
    if (initialized) return;
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        await memory.init();
      } catch (err) {
        console.warn("[embed] IndexedDB 不可用，降级到内存适配器（记忆不会持久化）:", err?.message ?? err);
        memory = new MemoryStore(createMemoryAdapter());
        try {
          await memory.init();
        } catch (err2) {
          console.warn("[embed] 内存适配器初始化也失败，记忆功能将不可用:", err2?.message ?? err2);
        }
      }
      initialized = true;
      // 启动当前宿主页面实时监听（MutationObserver 维护正文缓存，供 read_page_content 使用）。
      // 失败不阻断初始化：read_page_content 工具在无缓存时仍会实时读取页面。
      try {
        pageWatcher = initPageWatcher();
        if (pageWatcher) console.log("[embed] 已启动页面实时内容监听");
      } catch (err) {
        console.warn("[embed] 页面实时监听启动失败（read_page_content 仍可实时读取）:", err?.message ?? err);
        pageWatcher = null;
      }
      // 注册 Service Worker（best-effort，失败不阻塞主流程）
      await registerServiceWorker();
      // 硬件预检（不抛错，仅在可用时通知）
      try {
        const snapshot = await ai.probeHardware();
        emit({ type: "hardware", snapshot });
        // 自动选档：modelId === "auto" 时，根据硬件决定推荐档
        if (modelId === "auto" && !actualModelId) {
          actualModelId = recommendModelId(snapshot);
          // 推荐值必须真实存在于 SDK 目录（防 MODEL_OPTIONS 与目录脱节时推荐失效 id）
          actualModelId = resolveCatalogId(actualModelId);
          const recommendedOpt = getModelOptions().find((m) => m.id === actualModelId);
          emit({ type: "model-recommended", modelId: actualModelId, snapshot });
          emit({ type: "status", message: `为你的设备推荐：${recommendedOpt?.label ?? actualModelId}` });
        } else if (!actualModelId) {
          actualModelId = getDefaultModelId();
        }
        if (!snapshot.webgpuSupported) {
          const error = new Error(
            `当前浏览器不支持 WebGPU（${snapshot.webgpuReason ?? "未知原因"}），无法运行本地模型。`,
          );
          emit({ type: "error", error });
        }
      } catch (err) {
        console.warn("[embed] WebGPU 预检失败:", err);
        // 探测失败时也兜底：给一个最低档
        if (!actualModelId) actualModelId = getDefaultModelId();
      }
      console.log("[embed] 本地智能体已初始化 ✅");
    })();
    return initPromise;
  }

  /** 加载模型。默认加载 ready() 推荐的 modelId（或用户指定），可覆盖。 */
  async function load(modelIdOverride) {
    await ready();
    return loader.load(modelIdOverride ?? actualModelId ?? getDefaultModelId());
  }

  /** 模型是否已加载 */
  function isModelLoaded() {
    return Boolean(loader.getLoadedModelId());
  }

  function getLoadedModelId() {
    return loader.getLoadedModelId();
  }

  /** 获取当前推荐的模型 ID（ready() 后才有值；否则为 null 或用户指定值） */
  function getRecommendedModelId() {
    return actualModelId;
  }

  /**
   * 获取 SDK 目录中实际可加载的模型选项（用 BrowserAI.presets 过滤 MODEL_OPTIONS）。
   * UI 构建模型下拉时应使用本函数，避免展示"选中即 UnknownModelError"的失效档位。
   */
  function getAvailableModels() {
    return getAvailableModelOptions(ai?.presets);
  }

  /** 把任意 modelId 校正到 SDK 目录中存在的 id：存在则原样返回，否则取最低可用档 */
  function resolveCatalogId(modelId) {
    const presets = ai?.presets ?? [];
    if (presets.length === 0 || presets.some((p) => p.id === modelId)) return modelId;
    const options = getAvailableModelOptions(presets);
    const fallback = options.find((m) => m.tier === "low")?.id ?? options[0]?.id ?? modelId;
    console.warn(`[embed] 模型 "${modelId}" 不在 SDK 目录中，已降级为 "${fallback}"`);
    return fallback;
  }

  /**
   * 注册 Service Worker（best-effort）。
   * iframe 嵌入场景下 SW 注册可能被宿主页面限制；失败仅 console.warn，不阻断主流程。
   *
   * 关键设计：只 await register()，**不 await navigator.serviceWorker.ready**。
   * 原因：ready() 会等待首个 active worker，可能阻塞首屏 100~500ms。
   * 当前页面的请求仍走网络（首次访问正常下载），SW 在后台 worker 线程中
   * install + activate，下一次访问（页面刷新后）就能命中 SW 缓存。
   *
   * @returns {Promise<void>}
   */
  async function registerServiceWorker() {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    try {
      // scope: "/" 让 SW 拦截同源的所有路径（含 /hf* 模型路由）
      swRegistration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      console.log("[embed] Service Worker 已注册 ✅（激活在后台进行，下次访问生效）");
      emit({ type: "sw", registered: true });
    } catch (err) {
      console.warn("[embed] Service Worker 注册失败（不影响使用，离线缓存将不可用）:", err?.message ?? err);
      emit({ type: "sw", registered: false, error: err });
    }
  }

  /**
   * 对话（自动保存到历史；可多轮连续调用实现上下文）。
   * @param {string} text 用户输入
   * @param {object} [callbacks]
   * @param {(step:object)=>void} [callbacks.onStep] 过程回调（新增事件类型 ttft / tool-stats）：
   *        {type:"stream", text} | {type:"action", name, input} | {type:"observation", name, result, durationMs, ok, errorMessage} |
   *        {type:"final", text} | {type:"error", message} | {type:"ttft", durationMs, stepDurationMs, textLength}
   * @param {(full:string)=>void} [callbacks.onDelta] 模型流式输出（每轮生成累计文本）
   * @returns {Promise<{answer:string, steps:object[], rawTexts:string[]}>}
   */
  async function chat(text, { onStep, onDelta, signal } = {}) {
    if (typeof text !== "string" || !text.trim()) throw new Error("chat: 输入不能为空");
    if (chatting) throw new Error("chat: 已有对话正在进行");
    if (!loader.getLoadedModelId()) {
      throw new Error("模型尚未加载，请先调用 load()");
    }
    chatting = true;
    const chatStartedAt = performance.now();
    try {
      await memory.addMessage("user", text);
      // 注入当前页面信息（浏览器环境），帮助模型定位"当前页面"类问题
      let systemExtras = "";
      if (typeof document !== "undefined" && typeof location !== "undefined") {
        systemExtras = `当前所在页面：标题「${document.title}」，网址 ${location.href}。用户可能询问页面内容，需要时可调用 read_page_content 工具读取页面实时内容。`;
      }
      let result;
      try {
        result = await runAgent({
          userInput: text,
          memory,
          maxSteps,
          systemExtras,
          signal,
          generate: async (messages, generateCallbacks) =>
            ai.generateText(messages, {
              runtime: { maxTokens: 768 },
              onDelta: generateCallbacks.onDelta ?? onDelta,
              signal: generateCallbacks.signal,
            }),
          onStep,
        });
      } catch (err) {
        // runAgent 自身抛错（极少：默认所有错误都已转成 ok:false 返回）：
        //   1. 记到 failureLog（localStorage，最近 20 条）
        //   2. 构造占位 result 累积到 stats（让 totalToolFailures / sampleCount 包含异常路径）
        //   3. 重新抛给调用方（UI 层处理展示）
        const isAbort = err?.name === "AbortError" || /abort|中止/i.test(err?.message ?? "");
        failureLog.record({
          userInput: text,
          ok: false,
          reason: isAbort ? "aborted" : "exception",
          answer: err?.message ?? String(err),
          steps: [],
          rawTexts: [],
          signalAborted: isAbort,
        });
        // 即使异常也累积一次 stats（标记 ok=false, reason="exception" 或 "aborted"）
        recordStats(
          {
            ok: false,
            reason: isAbort ? "aborted" : "exception",
            steps: [],
            answer: "",
          },
          chatStartedAt,
        );
        emit({
          type: "chat-stats",
          stats: getStats().history[getStats().history.length - 1],
        });
        throw err;
      }
      if (result.ok !== false) {
        // 成功的回答落库到 IndexedDB 持久化历史
        await memory.addMessage("assistant", result.answer);
      } else {
        // 失败对话（aborted / loop / max_steps / error）：
        //   1. 落库 assistant（占位如"（已中止）"），保持历史连贯（否则下次 chat 会看到孤儿 user 消息）
        //   2. 记到 failureLog（localStorage，最近 20 条），便于调试
        await memory.addMessage("assistant", result.answer);
        failureLog.record({
          userInput: text,
          ok: false,
          reason: result.reason,
          answer: result.answer,
          steps: result.steps,
          rawTexts: result.rawTexts,
        });
      }
      // 性能埋点：累积本次 chat 的指标
      const stats = recordStats(result, chatStartedAt);
      emit({ type: "chat-stats", stats });
      return result;
    } finally {
      chatting = false;
    }
  }

  // ---- 记忆直通接口（宿主页面可直接读写） ----
  const getHistory = () => memory.getHistory();
  const clearHistory = () => memory.clearHistory();
  const getMemories = () => memory.getMemories();
  const saveMemory = (key, value) => memory.saveMemory(key, value);
  const recallMemory = (query) => memory.recall(query);
  const clearMemories = () => memory.clearMemories();

  // ---- 失败日志（调试用：失败对话不入持久化历史，但记到 localStorage 最近 20 条） ----
  const getFailureLog = () => failureLog.getAll();
  const clearFailureLog = () => failureLog.clear();

  // ---- 性能统计（累积每次 chat 的工具耗时 / 首 token 延迟 / 失败率） ----
  // 收集最近 20 次 chat 的快照，超过容量 FIFO 裁剪，避免内存泄漏
  const STATS_LIMIT = 20;
  function recordStats(result, chatStartedAt) {
    const steps = result.steps ?? [];
    const toolSteps = steps.filter((s) => s.type === "observation");
    const totalDurationMs = Math.round((performance.now() - chatStartedAt) * 100) / 100;
    const ttftStep = steps.find((s) => s.type === "ttft");
    const stats = {
      timestamp: Date.now(),
      ok: result.ok !== false,
      reason: result.reason ?? "success",
      totalDurationMs,
      toolCallCount: toolSteps.length,
      toolFailures: toolSteps.filter((s) => s.ok === false).length,
      toolTotalMs: toolSteps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0),
      ttftMs: ttftStep?.durationMs ?? null,
      // 明确 ttftMs 的语义：null 时区分原因（避免监控首 token 延迟时无从下手）
      ttftReason: ttftStep
        ? "ok"
        : result.ok === false && result.reason === "aborted"
          ? "aborted_before_first_token"
          : "no_streaming_or_fast_response",
      stepCount: steps.filter((s) => s.type === "raw").length,
    };
    chatStats.push(stats);
    while (chatStats.length > STATS_LIMIT) chatStats.shift();
    return stats;
  }
  function getStats() {
    const totalToolCalls = chatStats.reduce((s, c) => s + c.toolCallCount, 0);
    const totalToolMs = chatStats.reduce((s, c) => s + c.toolTotalMs, 0);
    const totalDurationMs = chatStats.reduce((s, c) => s + c.totalDurationMs, 0);
    return {
      sampleCount: chatStats.length,
      history: [...chatStats],
      avgTotalMs: chatStats.length
        ? Math.round((totalDurationMs / chatStats.length) * 100) / 100
        : 0,
      // 关键改动：原 avgToolMs 实际是"每 chat 的累计工具耗时"（单位 ms/chat），
      // 命名歧义容易误读。现拆为两个字段：
      avgToolMsPerChat: chatStats.length
        ? Math.round((totalToolMs / chatStats.length) * 100) / 100
        : 0,
      avgToolMsPerCall: totalToolCalls > 0
        ? Math.round((totalToolMs / totalToolCalls) * 100) / 100
        : 0,
      totalToolCalls,
      totalToolFailures: chatStats.reduce((s, c) => s + c.toolFailures, 0),
    };
  }
  function clearStats() {
    chatStats.length = 0;
  }

  /** 卸载模型（释放显存/WebGPU 上下文） */
  async function unload() {
    await loader.unload();
  }

  /** 完全销毁：卸载模型、停止页面监听并移除事件监听 */
  async function dispose() {
    await loader.unload();
    pageWatcher?.dispose();
    pageWatcher = null;
    loader.dispose();
  }

  return {
    ready,
    load,
    unload,
    dispose,
    chat,
    isModelLoaded,
    getLoadedModelId,
    getRecommendedModelId,
    getAvailableModels,
    getSWRegistration: () => swRegistration,
    getStats,
    clearStats,
    getHistory,
    clearHistory,
    getMemories,
    saveMemory,
    recallMemory,
    clearMemories,
    // 失败日志（调试用，宿主页面可挂一个"诊断"按钮调出来）
    getFailureLog,
    clearFailureLog,
    // 高级用法：暴露底层实例
    _ai: ai,
    _memory: memory,
  };
}
