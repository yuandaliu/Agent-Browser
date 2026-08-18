/**
 * pageReader.test.js — 页面读取器单元测试
 * 纯逻辑（截断 / 密度评分 / 非浏览器降级）在 Node 中测试；
 * DOM 相关（正文提取、实时缓存）由 E2E 覆盖。
 */
import { describe, it, expect } from "vitest";
import { truncateText, textDensityScore, getPageSnapshot, DEFAULT_MAX_CHARS } from "../../src/pageReader.js";

describe("truncateText — 智能截断", () => {
  it("短文本不截断", () => {
    const text = "这是一段不长的文本";
    expect(truncateText(text, 100)).toBe(text);
  });

  it("长文本保留首尾并带截断标记", () => {
    const text = "字".repeat(1000);
    const result = truncateText(text, 200);
    expect(result).toHaveLength(200);
    expect(result).toContain("[内容已截断");
    expect(result.startsWith("字")).toBe(true);
    expect(result.endsWith("字")).toBe(true);
  });

  it("默认上限 4000", () => {
    expect(DEFAULT_MAX_CHARS).toBe(4000);
    const long = "x".repeat(5000);
    expect(truncateText(long)).toHaveLength(4000);
  });

  it("空文本返回空串", () => {
    expect(truncateText("", 100)).toBe("");
  });
});

describe("textDensityScore — 文本密度评分", () => {
  it("纯文本（无链接）得分最高", () => {
    expect(textDensityScore({ totalText: 1000, linkText: 0 })).toBe(1);
  });

  it("纯链接得分为 0", () => {
    expect(textDensityScore({ totalText: 500, linkText: 500 })).toBe(0);
  });

  it("正文（链接少）得分高于导航（链接多）", () => {
    const article = textDensityScore({ totalText: 2000, linkText: 120 });
    const nav = textDensityScore({ totalText: 400, linkText: 360 });
    expect(article).toBeGreaterThan(nav);
  });

  it("接受字符串输入", () => {
    expect(textDensityScore({ totalText: "正文内容文字", linkText: "" })).toBe(1);
  });

  it("空文本为 0", () => {
    expect(textDensityScore({ totalText: 0, linkText: 0 })).toBe(0);
  });
});

describe("getPageSnapshot — 非浏览器环境降级", () => {
  it("Node 环境（无 document）返回可读错误而非抛异常", () => {
    const result = getPageSnapshot({});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("浏览器页面环境");
  });

  it("selector 模式在无 DOM 环境同样降级", () => {
    const result = getPageSnapshot({ selector: "#main" });
    expect(result.ok).toBe(false);
  });
});
