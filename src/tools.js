/**
 * tools.js — 智能体工具系统
 *
 * 工具：get_current_time（时间）、calculate（安全数学计算）、
 *       web_search（网络搜索，多后端降级）、read_page_content（读取当前嵌入页面实时内容）、
 *       save_memory / recall_memory（记忆）。
 *
 * calculate 使用手写的递归下降解析器（AST 求值），绝不使用 eval/Function，
 * 只支持：数字（含小数）、+ - * /、括号、一元负号、幂（**）。
 * 通过 TOOL_SCHEMAS 把工具描述注入 ReAct 系统提示词。
 */
import { getPageSnapshot } from "./pageReader.js";

// ---------------------------------------------------------------------------
// 安全计算器：tokenizer + 递归下降解析器
// ---------------------------------------------------------------------------

export class ExpressionError extends Error {}

const MAX_NUMBER_LENGTH = 20; // 防止超长数字
const MAX_DEPTH = 32; // 防止括号深度攻击

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      let dots = 0;
      while (j < expr.length && /[0-9.]/.test(expr[j])) {
        if (expr[j] === ".") dots++;
        if (dots > 1) throw new ExpressionError(`数字格式错误: "${expr.slice(i, j + 1)}"`);
        j++;
      }
      if (j - i > MAX_NUMBER_LENGTH) throw new ExpressionError("数字过长");
      const num = expr.slice(i, j);
      if (num === "." || num.endsWith(".") || num.startsWith(".")) {
        // 允许 .5 / 5. 之类的写法，但规范化为数字
      }
      tokens.push({ type: "num", value: Number(num) });
      i = j;
      continue;
    }
    if ("+-*/()".includes(ch)) {
      tokens.push({ type: ch, value: ch });
      i++;
      continue;
    }
    if (ch === "*" && expr[i + 1] === "*") {
      tokens.push({ type: "**", value: "**" });
      i += 2;
      continue;
    }
    throw new ExpressionError(`不支持的字符: "${ch}"`);
  }
  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }
  peek() {
    return this.tokens[this.pos];
  }
  next() {
    return this.tokens[this.pos++];
  }
  expect(type) {
    const tok = this.next();
    if (!tok || tok.type !== type) throw new ExpressionError(`期望 "${type}"，实际 ${tok ? tok.value : "表达式结束"}`);
    return tok;
  }
  parseExpression() {
    return this.parseAdditive();
  }
  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.peek() && (this.peek().type === "+" || this.peek().type === "-")) {
      const op = this.next().type;
      const right = this.parseMultiplicative();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }
  parseMultiplicative() {
    let left = this.parsePower();
    while (this.peek() && (this.peek().type === "*" || this.peek().type === "/")) {
      const op = this.next().type;
      const right = this.parsePower();
      if (op === "/" && right === 0) throw new ExpressionError("除数不能为 0");
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }
  parsePower() {
    const left = this.parseUnary();
    if (this.peek() && this.peek().type === "**") {
      this.next();
      const right = this.parsePower();
      const result = Math.pow(left, right);
      if (!Number.isFinite(result)) throw new ExpressionError("结果超出可表示范围");
      return result;
    }
    return left;
  }
  parseUnary() {
    if (this.peek() && (this.peek().type === "+" || this.peek().type === "-")) {
      const op = this.next().type;
      const value = this.parseUnary();
      return op === "-" ? -value : value;
    }
    return this.parsePrimary();
  }
  parsePrimary() {
    let depth = 0;
    const tok = this.peek();
    if (!tok) throw new ExpressionError("表达式不完整");
    if (tok.type === "num") {
      this.next();
      return tok.value;
    }
    if (tok.type === "(") {
      let p = this.pos;
      while (p < this.tokens.length) {
        if (this.tokens[p].type === "(") depth++;
        if (this.tokens[p].type === ")") depth--;
        if (depth === 0) break;
        p++;
      }
      if (depth !== 0) throw new ExpressionError("括号不匹配");
      if (p - this.pos > MAX_DEPTH) throw new ExpressionError("括号嵌套过深");
      this.next();
      const value = this.parseAdditive();
      this.expect(")");
      return value;
    }
    throw new ExpressionError(`意外的符号: "${tok.value}"`);
  }
}

/**
 * 安全计算表达式，返回数字。非法输入抛出 ExpressionError。
 */
export function safeEvaluate(expression) {
  if (typeof expression !== "string" || expression.trim().length === 0) {
    throw new ExpressionError("表达式为空");
  }
  if (expression.length > 200) throw new ExpressionError("表达式过长");
  const tokens = tokenize(expression);
  if (tokens.length === 0) throw new ExpressionError("表达式为空");
  const parser = new Parser(tokens);
  const result = parser.parseExpression();
  if (parser.peek()) throw new ExpressionError(`表达式末尾有多余内容: "${parser.peek().value}"`);
  if (!Number.isFinite(result)) throw new ExpressionError("结果不是有效数字");
  // 消除浮点误差并限制精度
  return Math.round(result * 1e10) / 1e10;
}

// ---------------------------------------------------------------------------
// 搜索工具（浏览器端 fetch，多后端降级）
// ---------------------------------------------------------------------------

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchDuckDuckGo(query) {
  const data = await fetchJson(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
  );
  const results = [];
  if (data.AbstractText) results.push(`摘要: ${data.AbstractText}`);
  if (data.Answer) results.push(`答案: ${data.Answer}`);
  for (const topic of data.RelatedTopics ?? []) {
    if (topic.Text) results.push(`- ${topic.Text}`);
    if (results.length >= 5) break;
  }
  return results;
}

async function searchWikipedia(query) {
  const data = await fetchJson(
    `https://zh.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch=${encodeURIComponent(
      query,
    )}&srlimit=3&utf8=1`,
  );
  const results = (data.query?.search ?? []).map((item, i) => `${i + 1}. ${item.title}：${item.snippet?.replace(/<[^>]+>/g, "") ?? ""}`);
  return results;
}

export async function runWebSearch(query) {
  const errors = [];
  const backends = [
    ["DuckDuckGo", searchDuckDuckGo],
    ["维基百科", searchWikipedia],
  ];
  for (const [name, fn] of backends) {
    try {
      const results = await fn(query);
      if (results && results.length > 0) {
        return `搜索"${query}"结果（来源 ${name}）：\n${results.join("\n")}`;
      }
      errors.push(`${name} 无结果`);
    } catch (err) {
      errors.push(`${name} 失败: ${err.message}`);
    }
  }
  return `搜索"${query}"未能获取结果。${errors.join("；")}`;
}

// ---------------------------------------------------------------------------
// 工具注册表
// ---------------------------------------------------------------------------

export const TOOL_SCHEMAS = {
  get_current_time: {
    description: "获取当前日期和时间（本地时区）。无需参数。",
    parameters: {},
    requiresContext: false,
  },
  calculate: {
    description: "执行数学计算。支持 + - * / 和括号，例如 12+34、45*67。传入 expression 参数。",
    parameters: { expression: "要计算的数学表达式字符串，如 \"12+34\"" },
    requiresContext: false,
  },
  web_search: {
    description: "在网络上搜索信息。传入 query 参数。",
    parameters: { query: "搜索关键词" },
    requiresContext: false,
  },
  read_page_content: {
    description:
      "读取当前嵌入页面（宿主网页）的实时内容，包括页面标题、网址与正文文本。不传 selector 时自动提取整个页面的正文内容（推荐用法，大多数情况直接这样调用）；可选 selector 参数只读取指定区域。当用户询问当前页面的内容、总结页面、或问题与当前页面有关时使用。",
    parameters: { selector: "CSS 选择器（可选，一般不传）" },
    requiresContext: false,
  },
  save_memory: {
    description: "记住用户告知的重要事实（如名字、偏好）。传入 key 和 value 参数。",
    parameters: { key: "记忆键名（如 name、preference）", value: "记忆内容（如 小明、喜欢咖啡）" },
    requiresContext: false,
  },
  recall_memory: {
    description:
      "回忆此前记住的事实（用户主动告知并保存的名字、偏好、城市等）。传入 query 参数。注意：本工具只用于回忆已保存的记忆，不读取网页内容；若用户询问的是当前页面内容，请使用 read_page_content 工具。",
    parameters: { query: "要回忆的关键词" },
    requiresContext: false,
  },
};

export const TOOL_NAMES = Object.keys(TOOL_SCHEMAS);

/** 生成 ReAct 系统提示词中的工具说明 */
export function toolsDescription() {
  return TOOL_NAMES.map(
    (name) =>
      `- ${name}: ${TOOL_SCHEMAS[name].description}` +
      (Object.keys(TOOL_SCHEMAS[name].parameters).length
        ? ` 参数: ${Object.entries(TOOL_SCHEMAS[name].parameters)
            .map(([k, v]) => `"${k}": ${v}`)
            .join(", ")}`
        : ""),
  ).join("\n");
}

/**
 * 执行工具。ctx 提供记忆 store。返回字符串形式的观察结果。
 * 任何异常都会转成可读的错误消息（绝不向模型抛出 JS 异常）。
 */
export async function runTool(name, input, ctx = {}) {
  const arg = (key) => (input && typeof input === "object" ? input[key] : undefined);
  // 解析器可能包装裸值：{"input": "..."}；工具侧按需取用
  const rawInput = (typeof input === "string" ? input : arg("input")) ?? undefined;

  switch (name) {
    case "get_current_time": {
      const now = new Date();
      const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
      const pad = (n) => String(n).padStart(2, "0");
      return (
        `当前时间：${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ` +
        `星期${weekdays[now.getDay()]} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ` +
        `（时区 ${Intl.DateTimeFormat().resolvedOptions().timeZone}）`
      );
    }

    case "calculate": {
      const expression = arg("expression") ?? rawInput;
      if (typeof expression !== "string" || !expression.trim()) {
        return "计算失败：缺少 expression 参数，例如 {\"expression\": \"12+34\"}";
      }
      try {
        const result = safeEvaluate(expression);
        return `${expression} = ${result}`;
      } catch (err) {
        return `计算失败：${err.message}`;
      }
    }

    case "web_search": {
      const query = arg("query") ?? rawInput;
      if (!query) return "搜索失败：缺少 query 参数";
      return runWebSearch(String(query));
    }

    case "read_page_content": {
      const selector = arg("selector") ?? rawInput;
      const snapshot = getPageSnapshot(
        typeof selector === "string" && selector.trim() ? { selector: selector.trim() } : {},
      );
      if (!snapshot.ok) return `读取失败：${snapshot.error}`;
      const head = `页面「${snapshot.title}」(${snapshot.url})`;
      const note = snapshot.note ? `${snapshot.note}\n` : "";
      return snapshot.text ? `${note}${head}\n${snapshot.text}` : `${note}${head}\n（页面无可见文本内容）`;
    }

    case "save_memory": {
      const key = arg("key") ?? input?.key;
      const value = arg("value") ?? input?.value;
      if (!key || value === undefined) return "记忆失败：需要 key 和 value 参数";
      if (!ctx.memory) return "记忆失败：记忆系统不可用";
      await ctx.memory.saveMemory(String(key), String(value));
      return `已记住：${key} = ${value}`;
    }

    case "recall_memory": {
      const query = arg("query") ?? rawInput;
      if (!ctx.memory) return "记忆失败：记忆系统不可用";
      const memories = await ctx.memory.recall(query);
      if (memories.length === 0) {
        return (
          "没有找到相关记忆。提示：recall_memory 只回忆用户此前主动告知并保存的事实（如名字、偏好）；" +
          "如果你是想了解当前页面的内容，请改用 read_page_content 工具读取页面。"
        );
      }
      return memories.map((m) => `${m.key} = ${m.value}`).join("\n");
    }

    default:
      return `未知工具：${name}`;
  }
}
