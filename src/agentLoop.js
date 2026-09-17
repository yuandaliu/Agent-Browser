/**
 * agentLoop.js — ReAct 思考-行动-观察循环
 *
 * 流程：
 *   1. 组装 messages：[system, ...最近对话历史, user]
 *   2. 模型生成 → parseReActOutput 解析
 *   3. 若解析出 Action → runTool 执行 → 把 Observation 拼回消息 → 回到 2
 *   4. 若解析出 Final（或无法解析）→ 返回最终答案
 *
 * parseReActOutput 面向 1B 级小模型的输出做了大量容错，按以下优先级解析：
 *   0) Qwen3 / Qwen3.5 thinking 模型：先 stripThinking 剥离 "thinking…response" 推理段
 *   1) Qwen 原生 <tool_call> XML 格式（Qwen3.5 模型最常用）：
 *      <tool_call>
 *        <function=calculate>
 *          <parameter=expression>12+34</parameter>
 *        </function>
 *      </tool_call>
 *   2) JSON 工具调用块（```json 围栏或 {"action":...} / {"name":...} / {"tool":...}）
 *   3) 标准 "Action: xxx / Action Input: {...}" 块（按行匹配，Action 行不依赖 Thought 上下文）
 *   4) 内联调用：Action: calculate(12+34) 形式
 *   5) Final: 文本（取最后一个）
 *
 * 全角冒号（：）、逗号（，）会被 normalizeColons 规整成半角后正则匹配。
 */

import { runTool, TOOL_NAMES, toolsDescription } from "./tools.js";
import {
  budgetMemoryContext,
  budgetObservation,
  budgetHistory,
  clipText,
  SYSTEM_PROMPT_BUDGET,
  SYSTEM_EXTRAS_BUDGET,
  SYSTEM_MEMORY_FALLBACK_BUDGET,
} from "./contextBudget.js";
import { validateToolInput, getOpenAIToolsFormat } from "./toolSchemas.js";

export const MAX_STEPS = 5;
export const MAX_HISTORY_MESSAGES = 8; // 送入模型的最近对话条数

// ---------------------------------------------------------------------------
// 系统提示词
// ---------------------------------------------------------------------------

export function buildSystemPrompt({ toolsDescription, memoryContext = "", systemExtras = "" } = {}) {
  const memoryBlock = memoryContext
    ? `\n你记得以下事实（来自长期记忆）：\n${memoryContext}\n`
    : "";
  const extrasBlock = systemExtras ? `\n${systemExtras}\n` : "";
  return `你是运行在浏览器本地的智能助手，通过"思考-行动-观察"循环使用工具完成任务。

你必须严格按以下格式输出，每次只输出一步，不要多余内容：

Thought: 你对当前情况的简短思考
Action: 工具名
Action Input: {"参数名": "参数值"}

工具执行结果会以 "Observation: 结果" 的形式提供给你。拿到结果后，要么继续输出
Thought/Action 调用下一个工具，要么直接给出最终答复：

Final: 你的最终答复（面向用户的完整中文回答）

可用工具：
${toolsDescription}
${memoryBlock}
${extrasBlock}
输出示例（用户问"现在几点"）：
Thought: 用户想知道当前时间，我需要调用时间工具。
Action: get_current_time
Action Input: {}
Final: 现在是 15 点 30 分。`;
}

/**
 * 原生（Qwen chat template）协议用的工具定义：每行一个 OpenAI 风格 JSON 对象。
 *
 * 依据 Qwen3.5 的 chat_template，tools 段由 `{{- tool | tojson }}` 逐行渲染，
 * 因此这里保持"一行一个 JSON"的形态，贴近模型训练时的分布。
 */
export function buildToolsJsonLines() {
  return getOpenAIToolsFormat()
    .map((tool) => JSON.stringify(tool))
    .join("\n");
}

/**
 * Qwen3 / Qwen3.5 原生工具协议提示词。
 *
 * 为什么不再用自创格式：模型的 chat_template 已定义了它训练过的工具协议——
 *   system 段给出 "# Tools" + <tools> 内的函数 JSON；
 *   模型以 <tool_call><function=name><parameter=k>v</parameter></function></tool_call> 回复；
 *   工具结果以 <tool_response>…</tool_response> 回传（见 runAgent 的 observation 包装）。
 * 解析侧无需新增路径：parseToolCallXml() 本就是按该格式实现的。
 *
 * 注意：本函数产出的文本要放进 system 消息（SDK 未暴露原生 tools 参数，无法让模板自行渲染），
 * 所以段落顺序刻意与模板一致：tools 段 → 格式说明 → 附加信息（页面/记忆）。
 */
export function buildNativeToolPrompt({ toolsJson = "", memoryContext = "", systemExtras = "" } = {}) {
  const memoryBlock = memoryContext
    ? `\n你记得以下事实（来自长期记忆）：\n${memoryContext}\n`
    : "";
  const extrasBlock = systemExtras ? `\n${systemExtras}\n` : "";
  return `# Tools

You have access to the following functions:

<tools>
${toolsJson}
</tools>

If you choose to call a function ONLY reply in the following format with NO suffix:

<tool_call>
<function=example_function_name>
<parameter=example_parameter_1>
value_1
</parameter>
</function>
</tool_call>

<IMPORTANT>
Reminder:
- Function calls MUST follow the specified format: an inner <function=...></function> block must be nested within <tool_call></tool_call> XML tags
- Required parameters MUST be specified
- You may provide optional reasoning for your function call in natural language BEFORE the function call, but NOT after
- If no function call is available, answer the question like normal with your current knowledge and do not tell the user about function calls
- 你是运行在浏览器本地的中文智能助手，最终回答请使用简体中文
</IMPORTANT>
${extrasBlock}${memoryBlock}`;
}

/**
 * 约束解码（structured output）协议提示词：要求模型只输出一个 JSON 对象。
 *
 * 配合 toolSchemas.buildDecisionSchema() 使用——宿主把它作为 `schema` 传给 SDK 后，
 * WebLLM 会用 grammar 约束解码保证输出符合该 schema，从根本上规避"小模型不遵循文本格式"。
 *
 * 字段语义见 buildDecisionSchema 注释：四个字段全部必填，用空字符串表示"不适用"。
 */
export function buildJsonDecisionPrompt({ toolsJson = "", memoryContext = "", systemExtras = "" } = {}) {
  const memoryBlock = memoryContext
    ? `\n你记得以下事实（来自长期记忆）：\n${memoryContext}\n`
    : "";
  const extrasBlock = systemExtras ? `\n${systemExtras}\n` : "";
  return `你是运行在浏览器本地的中文智能助手，可以调用工具完成任务。

你必须只输出一个 JSON 对象，不要输出任何其他文字、解释或代码块标记。JSON 字段：

- thought: 你的简短思考（字符串，没有可填 ""）
- action: 要调用的工具名（字符串）；不需要调用工具时必须为空字符串 ""
- input: 工具参数的 JSON 字符串，例如 "{\\"expression\\": \\"12+34\\"}"；无参数或不调用工具时填 "{}"
- final: 面向用户的最终中文回答（字符串）；调用工具时必须为空字符串 ""

规则：
- 需要外部信息（时间 / 计算 / 搜索 / 页面内容 / 记忆）时先调用工具：action 填工具名，input 填参数，final 留 ""
- 不需要工具、或工具结果已足够回答时：action 留 ""，把完整回答写进 final
- input 必须是 JSON 字符串，不要写嵌套对象

可用工具（每行一个 JSON）：
${toolsJson}
${extrasBlock}${memoryBlock}`;
}

/**
 * 控制 system prompt 整体长度（字符预算）。
 * 优先满足 4K token 上下文的小模型：工具描述/格式指令不可裁，
 * 超限时按 页面 extras → 长期记忆 的顺序降级裁剪，避免静默撑爆 context。
 *
 * @param {string} toolsDescription 工具定义。react 协议传文本说明；
 *        native / json 协议应传 buildToolsJsonLines() 的结果（每行一个 JSON）
 * @param {string} [memoryContext]
 * @param {string} [systemExtras]
 * @param {"react"|"native"|"json"} [protocol="react"] 工具协议（默认 react，保持既有行为）
 */
export function fitSystemPrompt(toolsDescription, memoryContext = "", systemExtras = "", protocol = "react") {
  const build = (mem, extras) => {
    if (protocol === "native") {
      return buildNativeToolPrompt({ toolsJson: toolsDescription, memoryContext: mem, systemExtras: extras });
    }
    if (protocol === "json") {
      return buildJsonDecisionPrompt({ toolsJson: toolsDescription, memoryContext: mem, systemExtras: extras });
    }
    return buildSystemPrompt({ toolsDescription, memoryContext: mem, systemExtras: extras });
  };
  let sys = build(memoryContext, systemExtras);
  if (sys.length <= SYSTEM_PROMPT_BUDGET) return sys;

  const extras2 = clipText(systemExtras, SYSTEM_EXTRAS_BUDGET, { label: "页面信息已截断" });
  sys = build(memoryContext, extras2);
  if (sys.length <= SYSTEM_PROMPT_BUDGET) return sys;

  const mem2 = clipText(memoryContext, SYSTEM_MEMORY_FALLBACK_BUDGET, { label: "记忆已截断" });
  return build(mem2, extras2);
}

// ---------------------------------------------------------------------------
// 解析器
// ---------------------------------------------------------------------------

/**
 * 剥离 Qwen3 / Qwen3.5 等 thinking 模型的推理段：
 * 输出形如 " thinking\n<推理内容>\n response\n\n<实际内容>"（可能带 <|thinking|> /
 * <|im_start|>assistant 前缀）。仅当文本以 thinking 行开头且存在 response 分隔时才剥离，
 * 否则原样返回（保守，不误伤普通对话文本）。
 */
export function stripThinking(text) {
  if (!text || typeof text !== "string") return text;
  const normalized = String(text)
    .replace(/^\s*<\|im_start\|>assistant\s*/i, "")
    .replace(/<\|thinking\|>/gi, "thinking\n")
    .replace(/<\|\/thinking\|>/gi, "response\n")
    // Qwen3.5 / Qwen3 的 chat template 用标准 XML 标签包裹推理段（<think>…</think>，见
    // enable_thinking 分支），与早期 <|thinking|> 特殊 token 是两套写法，这里一并归一为
    // thinking/response 标记，复用下方同一正则。
    .replace(/<\s*think\s*>/gi, "thinking\n")
    .replace(/<\s*\/\s*think\s*>/gi, "response\n");
  const m = normalized.match(/^\s*thinking\s*\n[\s\S]*?\n\s*response\s*\n?([\s\S]*)$/i);
  if (m) {
    const rest = m[1].trimStart();
    // response 段为空时保守返回原文（推理段里可能已含工具调用，交给后续解析路径）
    return rest || text;
  }
  return text;
}

/** 全角冒号/逗号规整为半角，便于正则 */
function normalizeColons(text) {
  return text.replace(/：/g, ":").replace(/，/g, ",").replace(/（/g, "(").replace(/）/g, ")");
}

/** 提取文本中最后一个 "Final: xxx" */
export function extractFinal(text) {
  const normalized = normalizeColons(text);
  const matches = [...normalized.matchAll(/Final\s*:\s*([\s\S]*?)(?=\n\s*(?:Thought|Action|Final)\s*:|\s*$)/gi)];
  if (matches.length === 0) return null;
  const raw = matches[matches.length - 1][1].trim();
  return raw.replace(/\s+$/g, "").trim();
}

/** 从文本中提取 Action 名称（行级匹配，避免 Thought 中的单词误判） */
function extractActionName(text) {
  const normalized = normalizeColons(text);
  // 优先：Action 行 + 其后紧跟 Action Input 行
  const blockMatch = normalized.match(/Action\s*:\s*([\w.-]+)[\s\S]*?Action\s+Input\s*:/i);
  if (blockMatch) return blockMatch[1].trim();
  // 其次：单独 Action 行（该行内容仅为工具名）
  const lineMatch = normalized.match(/^[ \t]*Action[ \t]*:[ \t]*([\w.-]+)[ \t]*$/gim);
  if (lineMatch) {
    const name = lineMatch[lineMatch.length - 1].match(/:[\s]*([\w.-]+)/)[1].trim();
    return name;
  }
  return null;
}

/** 提取 Action Input 的内容（{} JSON 块 / 内联括号 / 裸值） */
function extractActionInput(text) {
  const normalized = normalizeColons(text);
  const idx = normalized.search(/Action\s+Input\s*:/i);
  if (idx === -1) return null;

  let rest = normalized.slice(idx).replace(/^Action\s+Input\s*:\s*/i, "");
  // 截断到下一个格式标记
  rest = rest.replace(/\n\s*(?:Thought|Observation|Final)\s*:/i, "").trim();

  // JSON 对象块（含嵌套括号）
  if (rest.startsWith("{")) {
    let depth = 0;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "{") depth++;
      else if (rest[i] === "}") {
        depth--;
        if (depth === 0) return rest.slice(0, i + 1);
      }
    }
    return rest;
  }
  // 内联调用形式：get_current_time() 或 calculate(12+34)
  const inline = rest.match(/^\(([\s\S]*)\)\s*$/);
  if (inline) {
    const inner = inline[1].trim();
    if (inner.startsWith("{") || inner.includes(":")) {
      return inner.startsWith("{") ? inner : `{${inner}}`;
    }
    return inner;
  }
  // 裸值（如 {"expression"} 之外的裸字符串）
  return rest || null;
}

/**
 * 把 <tool_call> XML 参数值按 JSON 语义解析（true/false/数字/JSON 对象），失败保持字符串。
 */
function tryParseJsonValue(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch {
      /* 按字符串处理 */
    }
  }
  return raw;
}

/**
 * 解析 Qwen 原生 <tool_call> 工具调用 XML（Qwen3 / Qwen3.5 等新一代模型的本地格式）：
 *   <tool_call>
 *   <function=calculate>
 *   <parameter=expression>
 *   12+34
 *   </parameter>
 *   </function>
 *   </tool_call>
 * @returns {{name:string, input:object}|null} 未知工具或格式不完整返回 null
 */
export function parseToolCallXml(text) {
  if (!text || typeof text !== "string") return null;
  const blocks = [...text.matchAll(/<tool_call>([\s\S]*?)<\/tool_call>/gi)];
  if (blocks.length === 0) return null;
  const block = blocks[blocks.length - 1][1]; // 取最后一个（与 extractFinal 同策略）
  const fnMatch = block.match(/<function\s*=\s*([\w.-]+)>/i);
  if (!fnMatch) return null;
  const name = fnMatch[1].trim();
  if (!TOOL_NAMES.includes(name)) return null; // 未知工具：交给其他解析路径（如 Final）
  const input = {};
  for (const pm of block.matchAll(/<parameter\s*=\s*(.+?)>([\s\S]*?)<\/parameter>/gi)) {
    const key = pm[1].trim();
    input[key] = tryParseJsonValue(pm[2].trim());
  }
  return { name, input };
}

/**
 * 提取 JSON 工具调用块：优先 ```json 围栏；否则定位 {"action"/{"name"/{"tool" 起始，
 * 以花括号配平截取完整对象（支持多行与嵌套结构）。
 * @returns {string|null} JSON 文本或 null
 */
export function extractJsonToolCall(text) {
  if (!text || typeof text !== "string") return null;
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const startIdx = text.search(/\{\s*"(?:action|name|tool)"\s*:/i);
  if (startIdx === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }
  return null;
}

/**
 * 解析模型的 ReAct 输出。
 * @returns {{type:"action", name:string, input:any} | {type:"final", text:string} | {type:"unknown", text:string}}
 */
export function parseReActOutput(text) {
  if (!text || typeof text !== "string") return { type: "unknown", text: String(text ?? "") };

  // 0) Qwen3 / Qwen3.5 等 thinking 模型：剥离 "thinking…response" 推理段，只解析实际回复
  const core = stripThinking(text);
  const final = extractFinal(core);

  // 1) Qwen 原生 <tool_call> XML（Qwen3.5 等新一代模型输出）
  const xmlCall = parseToolCallXml(core);
  if (xmlCall) return { type: "action", name: xmlCall.name, input: xmlCall.input };

  // 2) JSON 工具调用块（```json 围栏或 {"action":…} 对象，支持多行/嵌套）
  const jsonCall = extractJsonToolCall(core);
  if (jsonCall) {
    try {
      const obj = JSON.parse(jsonCall);
      const name = obj.action ?? obj.name ?? obj.tool;
      if (name && TOOL_NAMES.includes(String(name))) {
        return { type: "action", name: String(name), input: obj.action_input ?? obj.input ?? obj.arguments ?? obj.parameters ?? {} };
      }
    } catch {
      /* 继续走其他解析路径 */
    }
  }

  const actionName = extractActionName(core);

  if (actionName) {
    const name = actionName.trim();
    if (TOOL_NAMES.includes(name)) {
      let input = null;
      try {
        const raw = extractActionInput(core);
        if (raw) {
          if (raw.trim().startsWith("{")) {
            input = JSON.parse(raw.trim());
          } else {
            // 裸值：包装成通用 input，工具侧再按需取用
            input = { input: raw.trim() };
          }
        }
      } catch {
        input = null;
      }
      if (input !== null) return { type: "action", name, input };
      // 有 Action 但无 Input：尝试用空参数（get_current_time 等无参工具）
      if (name === "get_current_time") return { type: "action", name, input: {} };
      return { type: "unknown", text: final ?? core.trim() };
    }
    // Action 名未知 → 若同时有 Final 优先用 Final，否则原样输出
    return { type: "unknown", text: final ?? core.trim() };
  }

  if (final) return { type: "final", text: final };
  return { type: "unknown", text: core.trim() };
}

/**
 * 解析"约束解码"协议（toolProtocol: "json"）的输出：一个决策 JSON 对象。
 *
 * 与 parseReActOutput 的关系：本函数是"优先级更高的独立路径"，只在 json 协议下被调用
 * （见 runAgent），因此不会影响 react / native 协议的既有解析行为。
 *
 * 期望形态（由 toolSchemas.buildDecisionSchema 约束）：
 *   { thought: string, action: string, input: string, final: string }
 *   - action 非空且为已注册工具名 → 工具调用；input 为 JSON 字符串（解析失败时按裸值包装）
 *   - action 为空且 final 非空     → 最终回答
 * 兼容：input 也可能是对象（模型不回退到字符串时），此时直接采用。
 *
 * @returns {{type:"action", name:string, input:any} | {type:"final", text:string} | null}
 *          非决策 JSON 时返回 null（调用方回退到 parseReActOutput）
 */
export function parseStructuredDecision(text) {
  if (!text || typeof text !== "string") return null;
  const core = stripThinking(text).trim();
  // 容忍模型用 ```json 围栏包裹（约束解码下通常不会出现，纯文本模式下可能）
  const fenced = core.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : core).trim();
  if (!candidate.startsWith("{")) return null;

  let obj;
  try {
    obj = JSON.parse(candidate);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;

  const actionName = typeof obj.action === "string" ? obj.action.trim() : "";
  let input = obj.input ?? obj.action_input ?? null;
  if (typeof input === "string") {
    const raw = input.trim();
    if (!raw || raw === "{}") {
      input = {};
    } else {
      try {
        input = JSON.parse(raw);
      } catch {
        input = { input: raw }; // 裸值：与 extractActionInput 的兜底策略一致
      }
    }
  }

  if (actionName && TOOL_NAMES.includes(actionName)) {
    return { type: "action", name: actionName, input: input ?? {} };
  }

  const finalText = typeof obj.final === "string" ? obj.final.trim() : "";
  if (finalText) return { type: "final", text: finalText };
  return null;
}

// ---------------------------------------------------------------------------
// ReAct 循环
// ---------------------------------------------------------------------------

/**
 * 运行一轮智能体对话。
 * @param {object} opts
 * @param {string} opts.userInput 用户输入
 * @param {object} opts.memory MemoryStore（getRecent / recall 等）
 * @param {(messages:Array, callbacks:{onDelta?:(full:string)=>void}) => Promise<{text:string}>} opts.generate
 *        模型生成函数（由调用方注入，便于测试与 UI 集成）
 * @param {(step:object)=>void} opts.onStep 过程回调（实际 emit 的 step type）：
 *        {type:"stream", text} | {type:"raw", text} | {type:"action", name, input} |
 *        {type:"observation", name, result, durationMs?, ok?, errorMessage?} |
 *        {type:"final", text} | {type:"error", message} | {type:"ttft", durationMs, stepDurationMs, textLength}
 * @param {number} opts.maxSteps 最大循环步数（默认 MAX_STEPS）
 * @param {string} [opts.systemExtras] 附加到系统提示词的额外上下文（如当前页面信息）
 * @param {"react"|"native"|"json"} [opts.toolProtocol="react"] 工具调用协议（默认 react）：
 *        react 用自创文本格式；native 用 Qwen chat template 原生 XML 协议；
 *        json 期望模型输出单个决策 JSON（通常配合约束解码，见 parseStructuredDecision）
 * @returns {Promise<{answer:string, rawTexts:string[], steps:object[]}>}
 */
export async function runAgent({ userInput, memory, generate, onStep = () => {}, maxSteps = MAX_STEPS, systemExtras = "", signal, toolProtocol = "react" }) {
  // 协议归一化：非白名单取值一律回退 react，避免宿主传错值时提示词与解析不匹配
  const protocol = toolProtocol === "native" || toolProtocol === "json" ? toolProtocol : "react";
  const steps = [];
  const rawTexts = [];
  const emit = (step) => {
    steps.push(step);
    onStep(step);
  };

  // 注入长期记忆摘要（若存在）—— 裁剪后注入，避免 system prompt 无限膨胀
  let memoryContext = "";
  try {
    const memories = await memory.recall("");
    if (memories && memories.length > 0) {
      memoryContext = budgetMemoryContext(memories);
    }
  } catch {
    /* 记忆不可用时不阻断对话 */
  }

  // system prompt 整体受预算约束（extras → 记忆 降级），防止小模型 context 被撑爆。
  // react 协议用文本工具说明；native / json 协议改用"每行一个 JSON"的函数定义，贴近 Qwen chat template
  const toolsPayload = protocol === "react" ? toolsDescription() : buildToolsJsonLines();
  const system = fitSystemPrompt(toolsPayload, memoryContext, systemExtras, protocol);

  // 组装消息：system + 最近历史（每条裁剪）+ 当前用户输入
  let history = [];
  try {
    history = await memory.getRecent(MAX_HISTORY_MESSAGES);
  } catch {
    history = [];
  }
  const budgetedHistory = budgetHistory(history);
  const messages = [
    { role: "system", content: system },
    ...budgetedHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userInput },
  ];

  let previousActionKey = null; // 死循环检测
  let actionRepeatCount = 0;

  for (let step = 0; step < maxSteps; step++) {
    if (signal?.aborted) {
      emit({ type: "error", message: "用户已中止对话" });
      return { answer: "（已中止）", rawTexts, steps, ok: false, reason: "aborted" };
    }
    let text;
    const stepStartedAt = performance.now();
    let firstTokenAt = null;
    try {
      const result = await generate(messages, {
        onDelta: (full) => {
          if (firstTokenAt === null) firstTokenAt = performance.now();
          emit({ type: "stream", text: full });
        },
        signal,
      });
      text = result.text ?? "";
    } catch (err) {
      // 识别 AbortError（SDK 在 abort 时可能抛）或 signal 已 abort，标记 reason 为 "aborted"
      // 而非 "error"——避免把用户主动中止当成生成失败
      if (err?.name === "AbortError" || signal?.aborted) {
        emit({ type: "error", message: "用户已中止对话" });
        return { answer: "（已中止）", rawTexts, steps, ok: false, reason: "aborted" };
      }
      emit({ type: "error", message: `模型生成失败: ${err?.message ?? err}` });
      return { answer: `抱歉，模型生成时出错：${err?.message ?? err}`, rawTexts, steps, ok: false, reason: "error" };
    }
    const stepDurationMs = Math.round((performance.now() - stepStartedAt) * 100) / 100;
    if (firstTokenAt !== null) {
      const ttft = Math.round((firstTokenAt - stepStartedAt) * 100) / 100;
      emit({ type: "ttft", durationMs: ttft, stepDurationMs, textLength: text.length });
    }
    rawTexts.push(text);

    // json 协议先按"决策 JSON"解析（约束解码的产物）；不匹配则回退到既有解析路径。
    // react / native 协议不进入该分支，行为与改动前完全一致。
    const parsed = (protocol === "json" ? parseStructuredDecision(text) : null) ?? parseReActOutput(text);
    emit({ type: "raw", text });

    if (parsed.type === "action") {
      // 死循环检测：连续相同 action（第 2 次重复注入换工具引导，第 3 次终止）
      const actionKey = `${parsed.name}:${JSON.stringify(parsed.input)}`;
      if (actionKey === previousActionKey) {
        actionRepeatCount++;
      } else {
        actionRepeatCount = 0;
      }
      previousActionKey = actionKey;

      emit({ type: "action", name: parsed.name, input: parsed.input });

      // 连续第 3 次调用同一工具（count >= 2）：终止循环，给出明确的失败说明
      if (actionRepeatCount >= 2) {
        const answer = `我连续 ${actionRepeatCount + 1} 次调用"${parsed.name}"工具仍未解决问题，已停止尝试。请换一种更明确的说法，或直接描述你的具体需求。`;
        return { answer, rawTexts, steps, ok: false, reason: "loop" };
      }

      // 集中校验工具参数（结构层）：必填字段、类型、additionalProperties。
      // 在调用 runTool 前把"字段缺失 / 类型错误"转成可读 observation 反馈给模型，
      // 避免校验逻辑分散在各个 handler 里被遗漏。
      let result;
      const validation = validateToolInput(parsed.name, parsed.input);
      if (!validation.ok) {
        const errMsg = `工具参数校验失败: ${validation.error}。请按工具说明重新调用。`;
        result = errMsg;
        emit({
          type: "observation",
          name: parsed.name,
          result: errMsg,
          ok: false,
          errorMessage: validation.error,
        });
      } else {
        let toolResult;
        try {
          toolResult = await runTool(parsed.name, parsed.input, { memory });
          // runTool 现在统一返回 {text, durationMs, ok, errorMessage} 对象（tools.js）。
          // 解包 text 用于拼回消息；durationMs/ok/errorMessage 用于性能埋点。
          result = toolResult.text;
          emit({
            type: "observation",
            name: parsed.name,
            result,
            durationMs: toolResult.durationMs,
            ok: toolResult.ok,
            errorMessage: toolResult.errorMessage,
          });
        } catch (err) {
          // runTool 自身已经把工具 handler 的异常 catch 成 {ok: false} 形态，
          // 这里能跑到通常是极少见情况（适配器/运行时异常），仍安全降级。
          result = `工具执行出错: ${err?.message ?? err}`;
          emit({ type: "observation", name: parsed.name, result, error: true });
        }
      }

      // 连续第 2 次调用同一工具（count === 1）：在观察中注入换工具引导，给模型纠错机会
      const hint =
        actionRepeatCount === 1
          ? `\n提示：这是你连续第 2 次调用 "${parsed.name}"，说明该工具没有解决问题。请停止调用它：换一个更合适的工具（如需读取页面内容请用 read_page_content），或直接输出 Final 回答。`
          : "";

      // 把模型输出与观察结果拼回消息，驱动下一步（Observation 裁剪后注入，不影响 UI 展示）
      messages.push({ role: "assistant", content: text });
      // 观察结果的包装随协议变化：
      //   react  → "Observation: …"（自创格式，既有单测断言该前缀）
      //   native / json → <tool_response>…</tool_response>：Qwen chat template 用它区分
      //     "工具结果回传"与"新的用户提问"——user 消息若以 <tool_response> 开头且以
      //     </tool_response> 结尾，模板不会把它当作新查询（否则会 raise_exception）。
      // 注意 hint 必须放在 </tool_response> 之内，否则会破坏模板的 endswith 判定。
      const observationBody = `${budgetObservation(result)}${hint}`;
      messages.push({
        role: "user",
        content:
          protocol === "react"
            ? `Observation: ${observationBody}`
            : `<tool_response>\n${observationBody}\n</tool_response>`,
      });
      continue;
    }

    // final / unknown → 结束
    const answer = parsed.type === "final" ? parsed.text : text.trim();
    emit({ type: "final", text: answer });
    return { answer, rawTexts, steps, ok: true };
  }

  emit({ type: "error", message: `超过最大步数（${maxSteps}），终止循环` });
  return { answer: "我尝试了多次但未能完成这个请求，请简化一下问题或换种说法。", rawTexts, steps, ok: false, reason: "max_steps" };
}
