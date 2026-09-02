/**
 * tools.test.js — 工具系统单元测试
 */
import { describe, it, expect } from "vitest";
import { safeEvaluate, ExpressionError, runTool, TOOL_NAMES } from "../../src/tools.js";

describe("safeEvaluate — 安全计算器", () => {
  it("两位数加减法", () => {
    expect(safeEvaluate("12+34")).toBe(46);
    expect(safeEvaluate("99-13")).toBe(86);
    expect(safeEvaluate("10+20+30")).toBe(60);
  });

  it("两位数乘除法", () => {
    expect(safeEvaluate("12*34")).toBe(408);
    expect(safeEvaluate("99/11")).toBe(9);
    expect(safeEvaluate("7*8")).toBe(56);
  });

  it("混合运算与优先级", () => {
    expect(safeEvaluate("2+3*4")).toBe(14);
    expect(safeEvaluate("(2+3)*4")).toBe(20);
    expect(safeEvaluate("100-50/2")).toBe(75);
  });

  it("括号与小数", () => {
    expect(safeEvaluate("(12+34)*2")).toBe(92);
    expect(safeEvaluate("3.5+1.25")).toBe(4.75);
    expect(safeEvaluate("0.5*2")).toBe(1);
  });

  it("负号与一元运算", () => {
    expect(safeEvaluate("-5+10")).toBe(5);
    expect(safeEvaluate("-(3+4)")).toBe(-7);
  });

  it("中文算式（全角符号）会被规整后计算", () => {
    // 模型可能输出全角符号，工具侧 tokenize 入口做规整（不再依赖测试里的 replace）
    expect(safeEvaluate("１２＋３４")).toBe(46);
    expect(safeEvaluate("１２＊３４")).toBe(408);
    expect(safeEvaluate("（２＋３）＊４")).toBe(20);
    expect(safeEvaluate("９９－１３")).toBe(86);
  });

  it("拒绝非法输入", () => {
    expect(() => safeEvaluate("12+")).toThrow(ExpressionError);
    expect(() => safeEvaluate("abc")).toThrow(ExpressionError);
    expect(() => safeEvaluate("12/0")).toThrow("除数");
    expect(() => safeEvaluate("2**1000")).toThrow();
    expect(() => safeEvaluate("")).toThrow(ExpressionError);
    expect(() => safeEvaluate("1;2")).toThrow(ExpressionError);
    expect(() => safeEvaluate("(1+2")).toThrow(ExpressionError);
  });

  it("绝不执行注入代码", () => {
    expect(() => safeEvaluate("process.exit(1)")).toThrow(ExpressionError);
    expect(() => safeEvaluate("globalThis")).toThrow(ExpressionError);
    expect(() => safeEvaluate("Math.max(1,2)")).toThrow(ExpressionError);
    expect(() => safeEvaluate("[1,2,3].length")).toThrow(ExpressionError);
  });
});

describe("runTool — 工具执行", () => {
  it("get_current_time 返回包含日期时间的结果", async () => {
    const result = await runTool("get_current_time", {});
    expect(result).toMatch(/当前时间|时间/);
    expect(result).toMatch(/\d{4}年/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("calculate 正常计算", async () => {
    const result = await runTool("calculate", { expression: "12*34" });
    expect(result).toBe("12*34 = 408");
  });

  it("calculate 缺少参数时给出友好提示", async () => {
    const result = await runTool("calculate", {});
    expect(result).toContain("计算失败");
  });

  it("未知工具返回错误消息而非抛异常", async () => {
    const result = await runTool("not_a_tool", {});
    expect(result).toContain("未知工具");
  });

  it("save_memory / recall_memory 使用注入的记忆 store", async () => {
    const store = {
      saveMemory: async () => {},
      recall: async (q) => (q === "名字" ? [{ key: "name", value: "小明" }] : []),
    };
    const saved = await runTool("save_memory", { key: "name", value: "小明" }, { memory: store });
    expect(saved).toContain("已记住");
    const recalled = await runTool("recall_memory", { query: "名字" }, { memory: store });
    expect(recalled).toContain("小明");
    const none = await runTool("recall_memory", { query: "不存在" }, { memory: store });
    expect(none).toContain("没有找到相关记忆");
    // 无结果时给出换工具引导（页面内容类问题 → read_page_content）
    expect(none).toContain("read_page_content");
  });

  it("工具注册表覆盖验收所需工具", () => {
    expect(TOOL_NAMES).toContain("get_current_time");
    expect(TOOL_NAMES).toContain("calculate");
    expect(TOOL_NAMES).toContain("web_search");
    expect(TOOL_NAMES).toContain("read_page_content");
    expect(TOOL_NAMES).toContain("save_memory");
    expect(TOOL_NAMES).toContain("recall_memory");
  });

  it("read_page_content 在非浏览器环境返回可读错误（Node 单元测试环境）", async () => {
    const result = await runTool("read_page_content", {});
    expect(result).toContain("读取失败");
    expect(result).toContain("浏览器页面环境");
  });
});
