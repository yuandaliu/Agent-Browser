/**
 * failureLog.js — 失败对话调试日志
 *
 * 用途：embed.js 默认只把 `ok !== false` 的对话写入 IndexedDB 持久化历史（避免
 * "失败文案"污染后续上下文）。但失败原因本身完全丢失，调试 / 复现问题时无从下手。
 *
 * 本模块把失败对话写到 localStorage 最近 20 条，附带时间戳、reason、steps、rawTexts
 * 等信息，便于用户 / 开发者事后查看"为什么这次没成功"。
 *
 * - 不影响主流程：写入失败时静默降级（仅 console.warn）
 * - 跨环境兼容：Node 单元测试用内存适配器，浏览器用 localStorage
 * - 用户可控：暴露 getFailureLog / clearFailureLog 给宿主页面
 */

import { clipText } from "./contextBudget.js";

const STORAGE_KEY = "local-llm-agent:failure-log";
const MAX_FAILURES = 20;

// 单条失败记录的内容裁剪参数（localStorage 5MB 保护）
const MAX_FAILURE_STEPS = 20; // steps 最多保留条数
const MAX_FAILURE_RAW = 4; // rawTexts 最多保留条数
const MAX_FAILURE_TEXT = 600; // 单条 step/raw 文本最大字符数

/** 裁剪 steps：保留最新 N 条，超长字段（text / result）截断 */
function sanitizeSteps(steps) {
  if (!Array.isArray(steps)) return steps;
  const clipField = (v) =>
    typeof v === "string" && v.length > MAX_FAILURE_TEXT
      ? clipText(v, MAX_FAILURE_TEXT, { label: "步骤原文已截断" })
      : v;
  return steps
    .slice(-MAX_FAILURE_STEPS)
    .map((s) => (s && typeof s === "object" ? { ...s, text: clipField(s.text), result: clipField(s.result) } : s));
}

/** 裁剪 rawTexts：保留最新 N 条，每条超长截断 */
function sanitizeRawTexts(rawTexts) {
  if (!Array.isArray(rawTexts)) return rawTexts;
  return rawTexts.slice(-MAX_FAILURE_RAW).map((t) => {
    const s = String(t ?? "");
    return s.length > MAX_FAILURE_TEXT ? clipText(s, MAX_FAILURE_TEXT, { label: "原始输出已截断" }) : t;
  });
}

/** 默认 storage 适配器：localStorage 优先，Node 环境降级内存 Map */
function createDefaultStorage() {
  if (typeof globalThis !== "undefined" && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

/**
 * 失败日志存储。
 * 适配器需实现 getItem / setItem / removeItem（localStorage / 内存 Map 皆可）。
 */
export class FailureLog {
  constructor(storage = createDefaultStorage()) {
    this.storage = storage;
  }

  /**
   * 写入一条失败记录。返回标准化后的记录（含 timestamp），失败返回 null。
   * @param {object} entry
   * @param {string} entry.userInput 用户输入
   * @param {boolean} entry.ok
   * @param {string} entry.reason 失败原因（loop / max_steps / error / aborted / exception）
   * @param {string} [entry.answer] 模型给出的失败文案
   * @param {object[]} [entry.steps] agentLoop 步骤
   * @param {string[]} [entry.rawTexts] 模型原始输出
   * @param {boolean} [entry.signalAborted] 是否被 AbortController 中止
   */
  record(entry) {
    try {
      const enriched = {
        timestamp: Date.now(),
        ...entry,
        // 容量保护：steps / rawTexts 裁剪后再入库，
        // 避免步骤原文（每步可达数千字符）累积撑爆 localStorage 5MB 配额
        steps: sanitizeSteps(entry.steps),
        rawTexts: sanitizeRawTexts(entry.rawTexts),
      };
      const list = this.#read();
      list.push(enriched);
      // 超限裁剪最旧（FIFO，保留最新 20 条）
      while (list.length > MAX_FAILURES) list.shift();
      this.#write(list);
      return enriched;
    } catch (err) {
      // 持久化失败不应阻断主流程
      console.warn("[failureLog] 记录失败:", err?.message ?? err);
      return null;
    }
  }

  /** 获取全部记录（按时间升序，旧 → 新） */
  getAll() {
    return this.#read();
  }

  /** 最近一条；空时返回 null */
  last() {
    const list = this.#read();
    return list.length > 0 ? list[list.length - 1] : null;
  }

  /** 当前记录数 */
  size() {
    return this.#read().length;
  }

  /** 清空全部 */
  clear() {
    try {
      this.storage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn("[failureLog] 清空失败:", err?.message ?? err);
    }
  }

  // ---- 私有 ----

  #read() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // 解析失败：当空记录处理，避免启动时崩
      return [];
    }
  }

  #write(list) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
}

// ---------------------------------------------------------------------------
// 便捷单例（浏览器环境）
// ---------------------------------------------------------------------------

let singleton = null;
export function getFailureLog() {
  if (!singleton) singleton = new FailureLog();
  return singleton;
}

export { STORAGE_KEY, MAX_FAILURES };
