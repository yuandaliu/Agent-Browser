/**
 * evalCases.test.js — 评测用例集的自身一致性守卫（REVIEW.md D4 / ROADMAP P4-A）
 *
 * 用例集是"agent 效果"的回归基线；基线自身出错（工具名漂移、id 重复、语义矛盾）
 * 会让它变成噪声源，而不是度量工具。因此在此做静态守卫。
 *
 * 注意：这里**不**校验"模型是否真的按期望调用了工具"——那需要真实 WebGPU，
 * 由 `npm run test:eval` 在浏览器里跑（见 tests/eval-agent.mjs）。
 */
import { describe, it, expect } from "vitest";
import { CASES, TOOL_NAMES } from "../eval-cases.mjs";
import { TOOL_NAMES as REGISTERED } from "../../src/tools.js";

describe("eval-cases 用例集自身一致性", () => {
  it("工具名直接取自注册表，不得漂移", () => {
    expect(TOOL_NAMES).toEqual(REGISTERED);
    expect(TOOL_NAMES.length).toBeGreaterThan(0);
  });

  it("用例 id 唯一（回归对比靠 id 对齐）", () => {
    const ids = CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每条用例的 expectTools 都必须是已注册的工具", () => {
    for (const c of CASES) {
      for (const t of c.expectTools) expect(REGISTERED).toContain(t);
    }
  });

  it("noTool 用例的 expectTools 必须为空（语义不得自相矛盾）", () => {
    for (const c of CASES) {
      if (c.noTool) expect(c.expectTools).toEqual([]);
    }
  });

  it("每条用例都有 id / category / prompt / note，且 prompt 非空", () => {
    for (const c of CASES) {
      expect(c.id).toBeTruthy();
      expect(c.category).toBeTruthy();
      expect(typeof c.prompt).toBe("string");
      expect(c.prompt.trim().length).toBeGreaterThan(0);
      expect(c.note).toBeTruthy();
    }
  });

  it("用例总数不少于 20 条，且五类覆盖齐全", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(20);
    const cats = new Set(CASES.map((c) => c.category));
    for (const need of ["单步工具", "多步组合", "无需工具", "参数异常", "注入诱导"]) {
      expect(cats.has(need)).toBe(true);
    }
  });
});
