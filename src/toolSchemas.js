/**
 * toolSchemas.js — 工具 JSON Schema 与轻量验证
 *
 * 用途：
 *   1. 把每个工具的 parametersSchema（定义在 tools.js 的 TOOLS 中）汇总为可消费的
 *      JSON Schema，让原生 function calling 风格的 SDK（OpenAI / Anthropic / WebLLM）能直接用。
 *   2. 提供 validateToolInput(name, input) 轻量级结构校验（必填字段、类型、additionalProperties）。
 *      业务合法性（如 calculate 的 expression 字符串）仍由工具 handler 自己负责。
 *
 * 设计取舍：
 *   - 不引入 zod / ajv 等依赖，保持项目无三方运行时依赖（除 SDK 外）
 *   - JSON Schema 字段覆盖 type / description / required / additionalProperties 等常用子集
 *   - 校验只做"必填字段 + 类型 + 额外字段"三层，不做 $ref 等高级特性
 *
 * 单一数据源：TOOL_JSON_SCHEMAS 由 tools.js 的 TOOLS[name].parametersSchema 派生，
 * 修改 TOOLS 一处即可，避免双源维护。
 */

import { TOOLS, TOOL_NAMES } from "./tools.js";

/**
 * 从 TOOLS 派生 JSON Schema 集合（每次访问都重新派生，确保 TOOLS 改动实时生效）
 */
function getSchemas() {
  const out = {};
  for (const name of TOOL_NAMES) {
    if (TOOLS[name].parametersSchema) {
      out[name] = TOOLS[name].parametersSchema;
    }
  }
  return out;
}

/**
 * 获取指定工具的 JSON Schema。
 * @param {string} toolName
 * @returns {object|null} schema 对象；未知工具返回 null
 */
export function getToolJsonSchema(toolName) {
  return getSchemas()[toolName] ?? null;
}

/**
 * 获取所有工具的 JSON Schema（key → schema）。
 * 返回浅拷贝防 mutation。
 */
export function getToolJsonSchemas() {
  return Object.fromEntries(
    Object.entries(getSchemas()).map(([name, schema]) => [name, { ...schema }]),
  );
}

/**
 * 校验工具输入是否符合 JSON Schema。
 * 校验范围：
 *   - input 必须是对象或 undefined（允许空参）
 *   - 必填字段必须存在
 *   - 字段类型必须匹配 schema（string / number / boolean / object）
 *   - 不允许 additionalProperties 出现在严格 schema 中
 *
 * 注意：这是**结构**校验，不验证字段值的业务合法性（工具 handler 自己做）。
 *
 * @param {string} toolName
 * @param {any} input
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function validateToolInput(toolName, input) {
  const schemas = getSchemas();
  const schema = schemas[toolName];
  if (!schema) return { ok: false, error: `未知工具: ${toolName}` };

  // 接受 null/undefined/空对象（无参工具）
  if (input == null || (typeof input === "object" && Object.keys(input).length === 0)) {
    if ((schema.required ?? []).length > 0) {
      return { ok: false, error: `缺少必填字段: ${schema.required.join(", ")}` };
    }
    return { ok: true };
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: `输入必须是对象，实际为 ${Array.isArray(input) ? "数组" : typeof input}` };
  }

  // 必填字段检查
  for (const key of schema.required ?? []) {
    if (!(key in input)) {
      return { ok: false, error: `缺少必填字段: ${key}` };
    }
  }

  // 类型检查（只做基础 type 校验）
  for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
    if (!(key in input)) continue; // 可选字段，跳过
    const expectedType = propSchema.type;
    if (!expectedType) continue;
    const actual = input[key];
    const actualType = actual === null ? "null" : Array.isArray(actual) ? "array" : typeof actual;
    // 宽松匹配：number 接受 numeric string（模型常输出）
    let matched = actualType === expectedType;
    if (!matched && expectedType === "number" && actualType === "string" && !Number.isNaN(Number(actual))) {
      matched = true;
    }
    if (!matched) {
      return { ok: false, error: `字段 "${key}" 类型错误：期望 ${expectedType}，实际 ${actualType}` };
    }
  }

  // additionalProperties 严格检查
  if (schema.additionalProperties === false) {
    const allowedKeys = new Set(Object.keys(schema.properties ?? {}));
    for (const key of Object.keys(input)) {
      if (!allowedKeys.has(key)) {
        return { ok: false, error: `不允许的额外字段: ${key}` };
      }
    }
  }

  return { ok: true };
}

/**
 * 把 JSON Schema 转成 OpenAI / Anthropic 风格的 function calling 格式（tool 描述）。
 * 用于对接原生 function calling SDK（OpenAI tools / Anthropic tools 等）。
 *
 * @returns {Array<{type:"function", function:{name, description, parameters}}>}
 */
export function getOpenAIToolsFormat() {
  const schemas = getSchemas();
  return TOOL_NAMES.filter((n) => schemas[n]).map((name) => ({
    type: "function",
    function: {
      name,
      description: TOOLS[name].description,
      parameters: schemas[name],
    },
  }));
}