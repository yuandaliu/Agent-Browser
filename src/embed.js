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
import { createModelLoader, getModelOptions, getDefaultModelId } from "./modelLoader.js";
import { runAgent } from "./agentLoop.js";
import { initPageWatcher, getPageSnapshot } from "./pageReader.js";
import { getFailureLog } from "./failureLog.js";

export { getModelOptions, getDefaultModelId, BrowserAI, getPageSnapshot, initPageWatcher };
export { safeEvaluate } from "./tools.js";
export { getFailureLog, resetFailureLogSingleton, FailureLog, MAX_FAILURES } from "./failureLog.js";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

/**
 * 创建本地智能体实例。
 * @param {object} options
 * @param {string} [options.modelId] 默认模型（getDefaultModelId()）
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
    modelId = getDefaultModelId(),
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
  const failureLog = getFailureLog();

  let initialized = false;
  let initPromise = null;
  let chatting = false;
  let pageWatcher = null;

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
      // 启动当前宿主页面实时监听（MutationObserver 维护正文缓存，供 read_page_content 使用）
      pageWatcher = initPageWatcher();
      if (pageWatcher) console.log("[embed] 已启动页面实时内容监听");
      // 硬件预检（不抛错，仅在可用时通知）
      try {
        const snapshot = await ai.probeHardware();
        emit({ type: "hardware", snapshot });
        if (!snapshot.webgpuSupported) {
          const error = new Error(
            `当前浏览器不支持 WebGPU（${snapshot.webgpuReason ?? "未知原因"}），无法运行本地模型。`,
          );
          emit({ type: "error", error });
        }
      } catch (err) {
        console.warn("[embed] WebGPU 预检失败:", err);
      }
      console.log("[embed] 本地智能体已初始化 ✅");
    })();
    return initPromise;
  }

  /** 加载模型。默认加载 options.modelId，可覆盖。 */
  async function load(modelIdOverride) {
    await ready();
    return loader.load(modelIdOverride ?? modelId);
  }

  /** 模型是否已加载 */
  function isModelLoaded() {
    return Boolean(loader.getLoadedModelId());
  }

  function getLoadedModelId() {
    return loader.getLoadedModelId();
  }

  /**
   * 对话（自动保存到历史；可多轮连续调用实现上下文）。
   * @param {string} text 用户输入
   * @param {object} [callbacks]
   * @param {(step:object)=>void} [callbacks.onStep] 过程回调：
   *        {type:"stream", text} | {type:"action", name, input} | {type:"observation", name, result} |
   *        {type:"final", text} | {type:"error", message}
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
        // 记录到失败日志后重新抛给调用方（UI 层处理展示）
        failureLog.record({
          userInput: text,
          ok: false,
          reason: "exception",
          answer: err?.message ?? String(err),
          steps: [],
          rawTexts: [],
          signalAborted: err?.name === "AbortError" || /abort|中止/i.test(err?.message ?? ""),
        });
        throw err;
      }
      if (result.ok !== false) {
        // 成功的回答落库到 IndexedDB 持久化历史
        await memory.addMessage("assistant", result.answer);
      } else {
        // 失败对话：仅记到 failureLog（localStorage，最近 20 条），不污染持久化历史
        failureLog.record({
          userInput: text,
          ok: false,
          reason: result.reason,
          answer: result.answer,
          steps: result.steps,
          rawTexts: result.rawTexts,
        });
      }
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
