/**
 * main.helpers.test.js — main.js 纯函数 helper 单元测试
 *
 * shortModelName / friendlyModelName 都是纯函数，从 main.js 末尾 export 出来便于单测。
 * 不测 UI 渲染部分（handleModelEvent / handleSend 等）—— 那些由 E2E 覆盖。
 *
 * main.js 顶层有副作用（创建 agent + await ready + DOM 操作 + 渲染下拉），
 * 在 Node 环境需要 mock document 与 embed.js 一起让顶层副作用不抛错。
 */

import { describe, it, expect, vi } from "vitest";

// DOM stub：让 main.js 顶层的 document.getElementById / addEventListener /
// createElement / appendChild 等调用全部 noop，不抛错。
const stubEl = () => ({
  appendChild: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  setAttribute: vi.fn(),
  classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() },
  style: {},
  dataset: {}, // main.js 第 51 行 `opt.dataset.tier = option.tier`
  textContent: "",
  innerHTML: "",
  value: "",
  text: "",
  placeholder: "",
  disabled: false,
  rows: 1,
  title: "",
  focus: vi.fn(),
  append: vi.fn(),
  querySelector: vi.fn(() => null),
  querySelectorAll: vi.fn(() => []),
  scrollTop: 0,
  scrollHeight: 0,
  insertBefore: vi.fn(),
  cloneNode: vi.fn(function () {
    return stubEl();
  }),
  firstChild: null,
  lastChild: null,
});

const documentStub = {
  getElementById: vi.fn(() => stubEl()),
  addEventListener: vi.fn(),
  createElement: vi.fn(() => stubEl()),
  createTextNode: vi.fn((text) => ({ textContent: text ?? "" })),
  createTreeWalker: vi.fn(() => ({ nextNode: () => null })),
  querySelector: vi.fn(() => null),
  querySelectorAll: vi.fn(() => []),
  body: stubEl(),
  head: stubEl(),
};
globalThis.document = documentStub;

const mockModelOptions = [
  {
    id: "Qwen3.5-0.8B-q4f16_1-MLC",
    label: "Qwen3.5 0.8B（低门槛，~447MB / 1.6GB 显存）",
  },
  {
    id: "Qwen3.5-2B-q4f16_1-MLC",
    label: "Qwen3.5 2B（推荐，~1.2GB / 2.2GB 显存）",
  },
  {
    id: "Qwen3.5-4B-q4f16_1-MLC",
    label: "Qwen3.5 4B（高质量，~2.4GB / 6GB 显存）",
  },
];

// 完全 mock embed.js：让 createLocalAgent 返回 stub，不让顶层副作用跑真实 agent。
// 返回的 stub 必须包含 main.js 用到的所有方法。
vi.mock("../../src/embed.js", () => {
  const stubAgent = {
    ready: vi.fn(async () => {}),
    on: vi.fn(() => () => {}),
    chat: vi.fn(async () => ({})),
    load: vi.fn(async () => {}),
    dispose: vi.fn(async () => {}),
    clearHistory: vi.fn(async () => {}),
    onEvent: () => () => {},
    getAvailableModels: () => mockModelOptions,
  };
  return {
    createLocalAgent: () => stubAgent,
    getModelOptions: () => mockModelOptions,
    getDefaultModelId: () => "Qwen3.5-2B-q4f16_1-MLC",
    getDefaultModelIdAsync: vi.fn(async () => "Qwen3.5-2B-q4f16_1-MLC"),
    recommendModelId: vi.fn(() => "Qwen3.5-2B-q4f16_1-MLC"),
    getAvailableModelOptions: vi.fn(() => mockModelOptions),
  };
});

const { shortModelName, friendlyModelName } = await import("../../src/main.js");

describe("shortModelName — 纯函数", () => {
  it("无斜杠的 id → 原样返回", () => {
    expect(shortModelName("Qwen3.5-2B-q4f16_1-MLC")).toBe("Qwen3.5-2B-q4f16_1-MLC");
  });

  it("有斜杠的 id → 取最后一段", () => {
    expect(shortModelName("owner/repo/path")).toBe("path");
    expect(shortModelName("foo/bar/baz")).toBe("baz");
  });

  it("空字符串 → 空字符串", () => {
    expect(shortModelName("")).toBe("");
  });
});

describe("friendlyModelName — 纯函数", () => {
  it("已知 id → 取 label 括号前的主名", () => {
    expect(friendlyModelName("Qwen3.5-2B-q4f16_1-MLC")).toBe("Qwen3.5 2B");
  });

  it("Qwen3.5 0.8B → 'Qwen3.5 0.8B'", () => {
    expect(friendlyModelName("Qwen3.5-0.8B-q4f16_1-MLC")).toBe("Qwen3.5 0.8B");
  });

  it("Qwen3.5 4B → 'Qwen3.5 4B'", () => {
    expect(friendlyModelName("Qwen3.5-4B-q4f16_1-MLC")).toBe("Qwen3.5 4B");
  });

  it("未知 id → 降级到 shortModelName（取最后一段）", () => {
    expect(friendlyModelName("unknown/model-id")).toBe("model-id");
  });
});
