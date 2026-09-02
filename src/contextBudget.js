/**
 * contextBudget.js — 上下文长度预算
 *
 * 1B 级模型的 context window 有限（通常 4K~8K token），而 system prompt（含全部长期记忆）、
 * 对话历史、工具 Observation 都可能很长，叠加后极易撑爆 context 导致生成失败或答非所问。
 *
 * 本模块统一裁剪策略，按优先级分配字符预算：
 *   - 工具描述 / 格式指令：不可裁（系统提示词骨架）
 *   - Observation：≤ OBSERVATION_BUDGET（工具结果注入下一轮前裁剪）
 *   - 历史：每条 ≤ HISTORY_ITEM_BUDGET
 *   - 长期记忆：≤ MEMORY_BUDGET（注入 system prompt 前）
 *
 * 注意：截断只影响「送入模型的文本」，不影响 UI 展示（UI 用未截断的 step.result）。
 */

export const MEMORY_BUDGET = 800; // 注入 system prompt 的长期记忆上限（字符）
export const OBSERVATION_BUDGET = 1500; // 单条 Observation 上限
export const HISTORY_ITEM_BUDGET = 500; // 单条历史消息上限
export const SEARCH_QUERY_BUDGET = 100; // web_search query 上限

/** 截断到指定长度，超长时尾部标注总长 */
export function clipText(text, limit, { label = "已截断" } = {}) {
  const s = String(text ?? "");
  if (s.length <= limit) return s;
  const suffix = `…[${label}，共 ${s.length} 字符]`;
  return s.slice(0, Math.max(limit - suffix.length, 1)) + suffix;
}

/** 裁剪长期记忆上下文（注入 system prompt 前） */
export function budgetMemoryContext(memories) {
  if (!memories || memories.length === 0) return "";
  const lines = memories.map((m) => `- ${m.key}: ${m.value}`);
  return clipText(lines.join("\n"), MEMORY_BUDGET, { label: "记忆已截断" });
}

/** 裁剪单条 Observation（注入下一轮消息前） */
export function budgetObservation(result) {
  return clipText(result, OBSERVATION_BUDGET, { label: "结果已截断" });
}

/** 裁剪历史消息数组（每条独立裁剪） */
export function budgetHistory(history) {
  return history.map((m) => ({ ...m, content: clipText(m.content, HISTORY_ITEM_BUDGET, { label: "历史已截断" }) }));
}

/** 校验 save_memory 的 key/value 长度，超长抛错给模型可读提示 */
export function validateMemoryEntry(key, value) {
  if (typeof key !== "string" || key.trim().length === 0) return "key 不能为空";
  if (key.length > 50) return "key 过长（≤50 字符）";
  if (typeof value !== "string" && value !== undefined && value !== null) return "value 必须是文本";
  if (typeof value === "string" && value.length > 500) return "value 过长（≤500 字符）";
  return null;
}
