/**
 * pageReader.test.js — 页面读取器单元测试
 * 纯逻辑（截断 / 密度评分 / 非浏览器降级）在 Node 中测试；
 * DOM 相关（正文提取、实时缓存）由 E2E 覆盖。
 */
import { describe, it, expect } from "vitest";
import {
  truncateText,
  textDensityScore,
  getPageSnapshot,
  DEFAULT_MAX_CHARS,
  isCssHidden,
  resolveSelectorRoot,
  patchHistory,
} from "../../src/pageReader.js";

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

describe("isCssHidden — 隐藏文本判定（#10）", () => {
  it("display:none / visibility:hidden / collapse / opacity:0 → 隐藏", () => {
    expect(isCssHidden({ display: "none" })).toBe(true);
    expect(isCssHidden({ visibility: "hidden" })).toBe(true);
    expect(isCssHidden({ visibility: "collapse" })).toBe(true);
    expect(isCssHidden({ opacity: "0" })).toBe(true);
  });

  it("正常样式与空值 → 可见（不误伤）", () => {
    expect(isCssHidden({ display: "block", visibility: "visible", opacity: "1" })).toBe(false);
    expect(isCssHidden(null)).toBe(false);
    expect(isCssHidden(undefined)).toBe(false);
  });
});

describe("resolveSelectorRoot — 非法选择器回退（#11）", () => {
  it("正常选择器返回元素", () => {
    const el = { tagName: "DIV" };
    const doc = { querySelector: (s) => (s === "#main" ? el : null) };
    expect(resolveSelectorRoot(doc, "#main")).toEqual({ root: el, error: null });
  });

  it("未命中返回 root=null 且无 error", () => {
    const doc = { querySelector: () => null };
    expect(resolveSelectorRoot(doc, "#missing")).toEqual({ root: null, error: null });
  });

  it("非法选择器抛错 → 转成 error 而不是冒泡到工具层", () => {
    const doc = {
      querySelector: () => {
        throw new Error("'div[' is not a valid selector");
      },
    };
    const result = resolveSelectorRoot(doc, "div[");
    expect(result.root).toBeNull();
    expect(result.error).toContain("not a valid selector");
  });

  it("无 doc / 无 querySelector / 空 selector → 安全返回", () => {
    expect(resolveSelectorRoot(null, "#a")).toEqual({ root: null, error: null });
    expect(resolveSelectorRoot({}, "#a")).toEqual({ root: null, error: null });
    expect(resolveSelectorRoot({ querySelector: () => ({}) }, "")).toEqual({
      root: null,
      error: null,
    });
  });
});

describe("patchHistory — SPA 路由补丁可还原（#7）", () => {
  function makeHistory() {
    const calls = [];
    const original = function (...args) {
      calls.push(args);
      return "ok";
    };
    return { calls, original, historyRef: { pushState: original, replaceState: original } };
  }

  it("patch 后 pushState 触发回调并透传返回值，restore 恢复原方法", () => {
    const { calls, original, historyRef } = makeHistory();
    const changes = [];
    const handle = patchHistory(() => changes.push("changed"), historyRef);
    expect(handle.patched).toBe(true);
    expect(historyRef.pushState).not.toBe(original);

    expect(historyRef.pushState("/next")).toBe("ok");
    expect(calls).toEqual([["/next"]]);
    expect(changes).toEqual(["changed"]);

    handle.restore();
    expect(historyRef.pushState).toBe(original);
    expect(historyRef.replaceState).toBe(original);
  });

  it("宿主后续替换了方法时 restore 不覆盖宿主实现", () => {
    const { historyRef } = makeHistory();
    const handle = patchHistory(() => {}, historyRef);
    const hostFn = () => "host";
    historyRef.pushState = hostFn;
    handle.restore();
    expect(historyRef.pushState).toBe(hostFn);
  });

  it("无 history / 缺 pushState 时安全降级（不抛错）", () => {
    expect(patchHistory(() => {}, null).patched).toBe(false);
    expect(() => patchHistory(() => {}, null).restore()).not.toThrow();
    expect(patchHistory(() => {}, {}).patched).toBe(false);
  });
});
