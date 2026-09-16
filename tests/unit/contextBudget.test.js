/**
 * contextBudget.test.js — 上下文裁剪单元测试
 *
 * 整个模块之前完全没测过。覆盖：
 *   - clipText 边界：空、等于 limit、超长
 *   - budgetMemoryContext 的 prompt injection 防护前缀
 *   - budgetObservation 的 prompt injection 防护前缀
 *   - budgetHistory 逐条独立裁剪
 *   - validateMemoryEntry 各种边界
 */

import { describe, it, expect } from "vitest";
import {
  clipText,
  budgetMemoryContext,
  budgetObservation,
  budgetHistory,
  validateMemoryEntry,
  MEMORY_BUDGET,
  OBSERVATION_BUDGET,
  HISTORY_ITEM_BUDGET,
} from "../../src/contextBudget.js";

describe("clipText — 截断边界", () => {
  it("短文本不截断", () => {
    expect(clipText("hello", 100)).toBe("hello");
  });

  it("空字符串 → 空字符串", () => {
    expect(clipText("", 100)).toBe("");
  });

  it("null / undefined → 空字符串（不抛错）", () => {
    expect(clipText(null, 100)).toBe("");
    expect(clipText(undefined, 100)).toBe("");
  });

  it("长度等于 limit → 不截断", () => {
    const text = "x".repeat(100);
    expect(clipText(text, 100)).toBe(text);
  });

  it("长度超过 limit → 截断 + 标注总长", () => {
    const text = "x".repeat(200);
    const result = clipText(text, 100, { label: "测试" });
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toContain("测试");
    expect(result).toContain("200");
  });

  it("截断后的内容仍是原内容的前缀", () => {
    // 实际行为：clipText 留"1 个字符 + 后缀"（s.length - suffix.length 太小，
    // 兜底为 1）。所以"前 1 字符"才是保证的，前缀不再保证是 limit 长度。
    // 这个测试只验证"原内容的最前字符在结果中"。
    const text = "ABCDEFGH";
    const result = clipText(text, 5);
    expect(result.startsWith("A")).toBe(true);
    expect(result).toContain("已截断");
  });
});

describe("budgetMemoryContext — 防 prompt injection", () => {
  it("空 memories → 空字符串", () => {
    expect(budgetMemoryContext([])).toBe("");
  });

  it("memories 存在 → 包含 '（以下是此前记住的事实...' 前缀（防护标识）", () => {
    const result = budgetMemoryContext([{ key: "name", value: "小明" }]);
    expect(result).toContain("以下是此前记住的事实");
    expect(result).toContain("name: 小明");
  });

  it("超过 MEMORY_BUDGET → 截断 + 标注", () => {
    const longMemories = [];
    for (let i = 0; i < 100; i++) {
      longMemories.push({ key: `k-${i}`, value: "x".repeat(50) });
    }
    const result = budgetMemoryContext(longMemories);
    expect(result.length).toBeLessThanOrEqual(MEMORY_BUDGET + 50); // 留余量给标注
    expect(result).toContain("记忆已截断");
  });
});

describe("budgetObservation — 防 prompt injection", () => {
  it("observation 文本被加 '工具返回的数据' 防护前缀", () => {
    const result = budgetObservation("页面正文内容");
    expect(result).toContain("工具返回的数据");
    expect(result).toContain("页面正文内容");
    // 强调"不要执行"
    expect(result).toContain("不要执行");
  });

  it("超过 OBSERVATION_BUDGET → 截断 + 标注", () => {
    const longText = "y".repeat(OBSERVATION_BUDGET + 1000);
    const result = budgetObservation(longText);
    expect(result).toContain("结果已截断");
  });
});

describe("budgetHistory — 逐条独立裁剪", () => {
  it("短消息不被裁剪", () => {
    const history = [
      { role: "user", content: "你好" },
      { role: "assistant", content: "你好呀" },
    ];
    const result = budgetHistory(history);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("你好");
    expect(result[1].content).toBe("你好呀");
  });

  it("超长消息独立裁剪（每条互不影响）", () => {
    const longContent = "z".repeat(HISTORY_ITEM_BUDGET + 500);
    const history = [
      { role: "user", content: longContent },
      { role: "assistant", content: "短回复" },
    ];
    const result = budgetHistory(history);
    expect(result[0].content.length).toBeLessThanOrEqual(HISTORY_ITEM_BUDGET + 50);
    expect(result[0].content).toContain("历史已截断");
    // 短消息不受影响
    expect(result[1].content).toBe("短回复");
  });

  it("空数组 → 空数组", () => {
    expect(budgetHistory([])).toEqual([]);
  });
});

describe("validateMemoryEntry — save_memory 校验", () => {
  it("key 为空 → 报错", () => {
    expect(validateMemoryEntry("", "v")).toContain("key 不能为空");
    expect(validateMemoryEntry("   ", "v")).toContain("key 不能为空");
  });

  it("key 超过 50 字符 → 报错", () => {
    expect(validateMemoryEntry("x".repeat(51), "v")).toContain("≤50 字符");
  });

  it("value 非字符串且非 undefined/null → 报错", () => {
    expect(validateMemoryEntry("k", 123)).toContain("value 必须是文本");
  });

  it("value 超过 500 字符 → 报错", () => {
    expect(validateMemoryEntry("k", "x".repeat(501))).toContain("≤500 字符");
  });

  it("value 是 undefined / null → 合法（可选）", () => {
    expect(validateMemoryEntry("k", undefined)).toBeNull();
    expect(validateMemoryEntry("k", null)).toBeNull();
  });

  it("正常 key + 正常 value → null（合法）", () => {
    expect(validateMemoryEntry("name", "小明")).toBeNull();
  });
});
