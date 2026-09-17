/**
 * agentLoop.protocol.test.js — 工具调用协议：原生（native）/ 约束解码（json）路径
 *
 * 覆盖三块能力：
 *   1. buildToolsJsonLines / buildNativeToolPrompt —— Qwen chat template 原生工具协议
 *   2. buildJsonDecisionPrompt / buildDecisionSchema / parseStructuredDecision —— 约束解码协议
 *   3. fitSystemPrompt 的 protocol 分支（默认 react 必须保持向后兼容）
 *
 * 注意：既有 react 协议的行为由 agentLoop.test.js / agentLoop.runAgent.test.js 覆盖，
 * 本文件不重复，也不改动既有断言。
 */
import { describe, it, expect } from "vitest";
import {
  buildNativeToolPrompt,
  buildJsonDecisionPrompt,
  buildToolsJsonLines,
  fitSystemPrompt,
  parseStructuredDecision,
} from "../../src/agentLoop.js";
import { buildDecisionSchema } from "../../src/toolSchemas.js";
import { TOOL_NAMES } from "../../src/tools.js";

describe("buildToolsJsonLines — 原生协议的 tools 段", () => {
  it("每个工具一行 JSON，行数等于已注册工具数", () => {
    const lines = buildToolsJsonLines().split("\n");
    expect(lines).toHaveLength(TOOL_NAMES.length);
  });

  it("每行都是合法的 OpenAI 风格 function 定义", () => {
    for (const line of buildToolsJsonLines().split("\n")) {
      const tool = JSON.parse(line);
      expect(tool.type).toBe("function");
      expect(TOOL_NAMES).toContain(tool.function.name);
      expect(tool.function.parameters).toBeTruthy();
    }
  });
});

describe("buildNativeToolPrompt — 原生协议提示词", () => {
  it("包含 <tools> 段与 <tool_call> 格式说明", () => {
    const prompt = buildNativeToolPrompt({ toolsJson: '{"type":"function"}' });
    expect(prompt).toContain("<tools>");
    expect(prompt).toContain('{"type":"function"}');
    expect(prompt).toContain("<tool_call>");
    expect(prompt).toContain("<parameter=");
  });

  it("不包含 ReAct 的 Action Input 格式（两种协议不混用）", () => {
    const prompt = buildNativeToolPrompt({ toolsJson: "x" });
    expect(prompt).not.toContain("Action Input");
  });

  it("记忆与页面信息作为附加段落注入", () => {
    const prompt = buildNativeToolPrompt({
      toolsJson: "x",
      memoryContext: "- name: 小明",
      systemExtras: "当前所在页面：示例",
    });
    expect(prompt).toContain("- name: 小明");
    expect(prompt).toContain("当前所在页面：示例");
  });

  it("无记忆时不产生空的记忆段标题", () => {
    expect(buildNativeToolPrompt({ toolsJson: "x" })).not.toContain("长期记忆");
  });
});

describe("buildJsonDecisionPrompt — 约束解码协议提示词", () => {
  it("要求只输出 JSON 对象并列出四个字段", () => {
    const prompt = buildJsonDecisionPrompt({ toolsJson: "x" });
    expect(prompt).toContain("JSON");
    for (const field of ["thought", "action", "input", "final"]) {
      expect(prompt).toContain(field);
    }
  });

  it("注入工具定义与附加信息", () => {
    const prompt = buildJsonDecisionPrompt({
      toolsJson: '{"type":"function"}',
      memoryContext: "- city: 北京",
      systemExtras: "当前所在页面：示例",
    });
    expect(prompt).toContain('{"type":"function"}');
    expect(prompt).toContain("- city: 北京");
    expect(prompt).toContain("当前所在页面：示例");
  });
});

describe("fitSystemPrompt — 协议分支", () => {
  it("默认（不传 protocol）为 react：包含 Observation 与 Action Input", () => {
    const prompt = fitSystemPrompt("- calculate: 计算");
    expect(prompt).toContain("Observation");
    expect(prompt).toContain("Action Input");
  });

  it("native：走原生协议，不含 Action Input", () => {
    const prompt = fitSystemPrompt('{"type":"function"}', "", "", "native");
    expect(prompt).toContain("<tools>");
    expect(prompt).toContain("<tool_call>");
    expect(prompt).not.toContain("Action Input");
  });

  it("json：走约束解码协议", () => {
    const prompt = fitSystemPrompt('{"type":"function"}', "", "", "json");
    expect(prompt).toContain('{"type":"function"}');
    expect(prompt).toContain("final");
    expect(prompt).not.toContain("Action Input");
  });

  it("协议不影响长度预算生效（超长附加信息仍被裁剪）", () => {
    const long = "页面信息".repeat(4000);
    const prompt = fitSystemPrompt('{"type":"function"}', "", long, "native");
    expect(prompt).toContain("页面信息已截断");
  });
});

describe("buildDecisionSchema — 约束解码用 schema", () => {
  it("action 被 enum 锁死为「已注册工具名 + 空串」", () => {
    const schema = buildDecisionSchema();
    expect(schema.properties.action.enum).toEqual([...TOOL_NAMES, ""]);
  });

  it("四个字段全部必填，且禁止额外字段", () => {
    const schema = buildDecisionSchema();
    expect(schema.required).toEqual(["thought", "action", "input", "final"]);
    expect(schema.additionalProperties).toBe(false);
  });

  it("不使用 oneOf / anyOf / $ref（WebLLM grammar 只支持基础子集）", () => {
    const text = JSON.stringify(buildDecisionSchema());
    expect(text).not.toContain("oneOf");
    expect(text).not.toContain("anyOf");
    expect(text).not.toContain("$ref");
  });
});

describe("parseStructuredDecision — 决策 JSON 解析", () => {
  it("action 非空且已注册 → action；input 从 JSON 字符串解析为对象", () => {
    const raw = '{"thought":"算一下","action":"calculate","input":"{\\"expression\\":\\"12+34\\"}","final":""}';
    expect(parseStructuredDecision(raw)).toEqual({
      type: "action",
      name: "calculate",
      input: { expression: "12+34" },
    });
  });

  it("input 为 \"{}\" → 空参数对象（无参工具）", () => {
    const raw = '{"thought":"","action":"get_current_time","input":"{}","final":""}';
    expect(parseStructuredDecision(raw)).toEqual({
      type: "action",
      name: "get_current_time",
      input: {},
    });
  });

  it("action 为空、final 非空 → final", () => {
    const raw = '{"thought":"","action":"","input":"{}","final":"现在是 15 点"}';
    expect(parseStructuredDecision(raw)).toEqual({ type: "final", text: "现在是 15 点" });
  });

  it("action 非空但工具未注册且无 final → null（交回其他解析路径）", () => {
    expect(parseStructuredDecision('{"action":"unknown_tool","input":"{}","final":""}')).toBeNull();
  });

  it("非 JSON / 空输入 → null", () => {
    expect(parseStructuredDecision("Final: 你好")).toBeNull();
    expect(parseStructuredDecision("")).toBeNull();
    expect(parseStructuredDecision(null)).toBeNull();
  });

  it("容忍 ```json 围栏", () => {
    const raw = '```json\n{"thought":"","action":"","input":"{}","final":"好"}\n```';
    expect(parseStructuredDecision(raw)).toEqual({ type: "final", text: "好" });
  });

  it("input 直接是对象时原样采用", () => {
    const raw = '{"action":"calculate","input":{"expression":"1+1"},"final":""}';
    expect(parseStructuredDecision(raw)).toEqual({
      type: "action",
      name: "calculate",
      input: { expression: "1+1" },
    });
  });

  it("input 是无法解析为 JSON 的裸值时包装为 { input }", () => {
    const raw = '{"action":"web_search","input":"北京天气","final":""}';
    expect(parseStructuredDecision(raw)).toEqual({
      type: "action",
      name: "web_search",
      input: { input: "北京天气" },
    });
  });
});
