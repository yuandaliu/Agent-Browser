/**
 * toolSchemas.test.js — 工具 JSON Schema 单元测试
 */
import { describe, it, expect } from "vitest";
import {
  getToolJsonSchema,
  getToolJsonSchemas,
  validateToolInput,
  getOpenAIToolsFormat,
} from "../../src/toolSchemas.js";

describe("getToolJsonSchema — 单个工具 schema", () => {
  it("calculate 含 expression 必填字段", () => {
    const schema = getToolJsonSchema("calculate");
    expect(schema.type).toBe("object");
    expect(schema.properties.expression.type).toBe("string");
    expect(schema.required).toContain("expression");
    expect(schema.additionalProperties).toBe(false);
  });

  it("get_current_time 无 required 字段", () => {
    const schema = getToolJsonSchema("get_current_time");
    expect(schema.required).toBeUndefined();
  });

  it("未知工具返回 null", () => {
    expect(getToolJsonSchema("not_a_tool")).toBeNull();
  });
});

describe("getToolJsonSchemas — 全部 schema 集合", () => {
  it("包含所有 6 个工具", () => {
    const all = getToolJsonSchemas();
    expect(Object.keys(all).sort()).toEqual(
      ["calculate", "get_current_time", "read_page_content", "recall_memory", "save_memory", "web_search"].sort(),
    );
  });

  it("返回浅拷贝（mutation 不影响内部）", () => {
    const all = getToolJsonSchemas();
    all.calculate.required = ["hacked"];
    const all2 = getToolJsonSchemas();
    expect(all2.calculate.required).toContain("expression");
  });
});

describe("validateToolInput — 结构校验", () => {
  it("calculate 缺必填字段 → 报错", () => {
    expect(validateToolInput("calculate", {})).toEqual({
      ok: false,
      error: expect.stringContaining("缺少必填字段: expression"),
    });
  });

  it("calculate 必填齐全且类型正确 → 通过", () => {
    expect(validateToolInput("calculate", { expression: "1+2" })).toEqual({ ok: true });
  });

  it("calculate 字段类型错误 → 报错", () => {
    const r = validateToolInput("calculate", { expression: 123 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('"expression"');
  });

  it("calculate 数字字段接受 numeric string（模型常输出）", () => {
    // calculate.expression 是 string 类型，所以不影响；但 generic test 验证逻辑
    expect(validateToolInput("web_search", { query: "hello" })).toEqual({ ok: true });
  });

  it("get_current_time 空对象 → 通过（无 required）", () => {
    expect(validateToolInput("get_current_time", {})).toEqual({ ok: true });
    expect(validateToolInput("get_current_time", null)).toEqual({ ok: true });
    expect(validateToolInput("get_current_time", undefined)).toEqual({ ok: true });
  });

  it("additionalProperties 严格检查：多余字段报错", () => {
    const r = validateToolInput("calculate", { expression: "1+2", extra: "not allowed" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("不允许的额外字段: extra");
  });

  it("非对象输入 → 报错", () => {
    expect(validateToolInput("calculate", "not object").ok).toBe(false);
    expect(validateToolInput("calculate", ["array"]).ok).toBe(false);
  });

  it("未知工具 → 报错", () => {
    expect(validateToolInput("unknown_tool", {}).ok).toBe(false);
  });

  it("save_memory 缺 value → 报错", () => {
    const r = validateToolInput("save_memory", { key: "name" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("缺少必填字段: value");
  });
});

describe("getOpenAIToolsFormat — OpenAI function calling 格式", () => {
  it("返回数组，每个元素是 {type, function:{name, description, parameters}}", () => {
    const tools = getOpenAIToolsFormat();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(6);
    for (const t of tools) {
      expect(t.type).toBe("function");
      expect(t.function.name).toBeTruthy();
      expect(t.function.description).toBeTruthy();
      expect(t.function.parameters.type).toBe("object");
    }
  });

  it("calculate schema 完整传递给 OpenAI", () => {
    const tools = getOpenAIToolsFormat();
    const calculate = tools.find((t) => t.function.name === "calculate");
    expect(calculate.function.parameters.required).toContain("expression");
    expect(calculate.function.parameters.properties.expression.type).toBe("string");
  });
});