/**
 * tools.handlers.test.js — 各工具 handler 边界回归测试
 *
 * 基础 safeEvaluate / runTool 已测（tools.test.js）。本文件覆盖：
 *   - get_current_time 格式
 *   - read_page_content selector 模式 + 未命中回退
 *   - runWebSearch DuckDuckGo / Wikipedia fallback
 *   - recall_memory 空结果提示
 *   - save_memory 缺 ctx.memory
 *   - calculate 全角符号规整
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runTool, runWebSearch, safeEvaluate, TOOLS } from "../../src/tools.js";

describe("TOOL_NAMES — 注册表完整性", () => {
  it("包含全部 6 个工具", () => {
    const names = Object.keys(TOOLS).sort();
    expect(names).toEqual(
      [
        "calculate",
        "get_current_time",
        "read_page_content",
        "recall_memory",
        "save_memory",
        "web_search",
      ].sort(),
    );
  });
});

describe("get_current_time handler", () => {
  it("返回包含日期、时间、星期、时区的字符串", async () => {
    const result = await runTool("get_current_time", {});
    expect(result.ok).toBe(true);
    expect(result.text).toMatch(/当前时间/);
    expect(result.text).toMatch(/\d{4}年/);
    expect(result.text).toMatch(/星期[一二三四五六日]/);
    expect(result.text).toMatch(/\d{2}:\d{2}/);
    expect(result.text).toMatch(/时区/);
  });
});

describe("calculate handler — 全角符号", () => {
  it("全角数字 / 全角运算符（＊）都被规整计算", () => {
    // 实际支持的 normalize：＋ → +、－ → -、＊ → *、／ → /
    // 注：×（U+00D7 数学乘号）不在 normalize 列表里，会抛"不支持的字符"
    expect(safeEvaluate("（１＋２）＊３")).toBe(9);
  });

  it("中文括号 → 英文括号", () => {
    expect(safeEvaluate("（２＋３）")).toBe(5);
  });
});

describe("web_search handler", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("DuckDuckGo 返回结果 → 走 DuckDuckGo 后端，不调用 Wikipedia", async () => {
    globalThis.fetch = vi.fn(async (url) => {
      if (url.toString().includes("duckduckgo.com")) {
        return {
          ok: true,
          json: async () => ({
            AbstractText: "测试摘要",
            Answer: "测试答案",
            RelatedTopics: [],
          }),
        };
      }
      throw new Error("不应调用 Wikipedia");
    });
    const result = await runWebSearch("测试");
    expect(result).toContain("测试摘要");
    expect(result).toContain("DuckDuckGo");
  });

  it("DuckDuckGo 无结果 + Wikipedia 有结果 → fallback 到 Wikipedia", async () => {
    globalThis.fetch = vi.fn(async (url) => {
      if (url.toString().includes("duckduckgo.com")) {
        return {
          ok: true,
          json: async () => ({ RelatedTopics: [] }),
        };
      }
      if (url.toString().includes("wikipedia.org")) {
        return {
          ok: true,
          json: async () => ({
            query: {
              search: [
                { title: "测试词条", snippet: "测试 snippet" },
              ],
            },
          }),
        };
      }
      throw new Error("未预期的 URL: " + url);
    });
    const result = await runWebSearch("测试");
    expect(result).toContain("测试词条");
    expect(result).toContain("维基百科");
  });

  it("DuckDuckGo 失败 + Wikipedia 失败 → 返回带错误信息的文本", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("网络错误");
    });
    const result = await runWebSearch("测试");
    expect(result).toContain("未能获取结果");
  });
});

// mock pageReader 模块以拦截 getPageSnapshot（之前直接 pageReader.getPageSnapshot = ...
// 赋值失败：ESM import 绑定是只读的）
vi.mock("../../src/pageReader.js", async () => {
  const actual = await vi.importActual("../../src/pageReader.js");
  return {
    ...actual,
    getPageSnapshot: vi.fn(({ selector } = {}) => {
      if (selector === "#main") {
        return {
          ok: true,
          title: "测试页",
          url: "https://example.com",
          text: "正文内容",
        };
      }
      return { ok: false, error: "未找到选择器" };
    }),
  };
});

describe("read_page_content handler", () => {
  it("selector 命中 → 返回指定区域内容（标题、URL）", async () => {
    const result = await runTool("read_page_content", { selector: "#main" });
    expect(result.ok).toBe(true);
    expect(result.text).toContain("测试页");
    expect(result.text).toContain("正文内容");
  });
});

describe("save_memory handler", () => {
  it("缺 ctx.memory → 抛错（runTool 捕获成 ok: false）", async () => {
    const result = await runTool("save_memory", { key: "name", value: "小明" });
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("记忆系统不可用");
  });

  it("校验失败 → 友好提示（不抛错）", async () => {
    const store = { saveMemory: vi.fn() };
    const result = await runTool("save_memory", { key: "", value: "x" }, { memory: store });
    expect(result.ok).toBe(true); // runTool 层面是 ok 的（返回的是错误信息字符串）
    expect(result.text).toContain("记忆失败");
    expect(store.saveMemory).not.toHaveBeenCalled();
  });
});

describe("recall_memory handler", () => {
  it("无记忆 → 返回 read_page_content 引导", async () => {
    const result = await runTool("recall_memory", { query: "不存在" }, { memory: { recall: async () => [] } });
    expect(result.ok).toBe(true);
    expect(result.text).toContain("没有找到相关记忆");
    expect(result.text).toContain("read_page_content");
  });

  it("有记忆 → 列出 key = value", async () => {
    const result = await runTool(
      "recall_memory",
      { query: "name" },
      { memory: { recall: async () => [{ key: "name", value: "小明" }, { key: "city", value: "北京" }] } },
    );
    expect(result.text).toContain("name = 小明");
    expect(result.text).toContain("city = 北京");
  });
});
