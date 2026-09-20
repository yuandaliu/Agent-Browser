/**
 * chatWidget.test.js — 统一聊天组件单元测试
 *
 * 组件是三个页面（index / search / demo）共用的聊天 UI 核心，这里覆盖其逻辑分支：
 * 构建与初始态、启用开关、未启用时的提示、并发守卫（生成中再次发送 = 中止）、新对话重置。
 * 用轻量 DOM stub（不引入 jsdom），只验证逻辑，不验证视觉渲染（那由 E2E 覆盖）。
 */
import { describe, it, expect, vi } from "vitest";

/** 在树中按谓词查找节点（广度优先），stub 与断言共用 */
function find(root, predicate) {
  const stack = [root];
  while (stack.length) {
    const node = stack.shift();
    if (predicate(node)) return node;
    for (const child of node.children ?? []) stack.push(child);
  }
  return null;
}

const hasClass = (node, cls) => String(node.className ?? "").split(/\s+/).includes(cls);

// ---------- 轻量 DOM stub ----------
function makeEl(tag = "div") {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    parent: null,
    className: "",
    innerHTML: "",
    disabled: false,
    rows: 0,
    placeholder: "",
    title: "",
    style: {},
    listeners: {},
    _classes: new Set(),
    classList: {
      add: (c) => el._classes.add(c),
      remove: (c) => el._classes.delete(c),
      toggle: (c) => (el._classes.has(c) ? (el._classes.delete(c), false) : (el._classes.add(c), true)),
      contains: (c) => el._classes.has(c),
    },
    setAttribute: vi.fn(),
    addEventListener(type, fn) {
      (el.listeners[type] ||= []).push(fn);
    },
    appendChild(child) {
      child.parent = el;
      el.children.push(child);
      return child;
    },
    append(...nodes) {
      nodes.forEach((n) => el.appendChild(n));
    },
    remove() {
      if (el.parent) el.parent.children = el.parent.children.filter((c) => c !== el);
      el.parent = null;
    },
    focus: vi.fn(),
    get childElementCount() {
      return el.children.length;
    },
  };

  // textContent 保持真实 DOM 语义：赋值即替换全部子节点
  let text = "";
  Object.defineProperty(el, "textContent", {
    get: () => text,
    set: (v) => {
      text = String(v ?? "");
      el.children = [];
    },
    enumerable: true,
  });

  // 支持按类名查询（组件用 querySelector 移除欢迎语）
  el.querySelector = (sel) => {
    const cls = typeof sel === "string" && sel.startsWith(".") ? sel.slice(1) : null;
    return cls ? find(el, (n) => n !== el && hasClass(n, cls)) : null;
  };

  return el;
}

globalThis.document = { createElement: vi.fn((tag) => makeEl(tag)) };

const { createChatWidget } = await import("../../src/chatWidget.js");

function makeAgent(overrides = {}) {
  return {
    chat: vi.fn(async () => ({ answer: "答案", ok: true, steps: [] })),
    clearHistory: vi.fn(async () => {}),
    ...overrides,
  };
}

/** 建好组件并返回常用节点 */
function setup(agent = makeAgent()) {
  const host = makeEl();
  const widget = createChatWidget({ container: host, agent });
  const root = host.children[0];
  return {
    host,
    agent,
    widget,
    root,
    input: find(root, (n) => hasClass(n, "la-input")),
    sendBtn: find(root, (n) => hasClass(n, "la-send")),
  };
}

describe("createChatWidget — 构建与初始态", () => {
  it("挂载后容器内出现 .la-chat 根节点，输入与发送按钮初始禁用", () => {
    const { root, input, sendBtn, widget } = setup();
    expect(root.className).toBe("la-chat");
    expect(input.disabled).toBe(true);
    expect(sendBtn.disabled).toBe(true);
    widget.destroy();
  });

  it("缺少 container 或 agent 时抛错", () => {
    expect(() => createChatWidget({ agent: makeAgent() })).toThrow(/container/);
    expect(() => createChatWidget({ container: makeEl() })).toThrow(/agent/);
  });

  it("showNewChat: false 时不渲染新对话按钮", () => {
    const host = makeEl();
    const widget = createChatWidget({ container: host, agent: makeAgent(), showNewChat: false });
    expect(find(host.children[0], (n) => hasClass(n, "la-newchat"))).toBeNull();
    widget.destroy();
  });
});

describe("createChatWidget — 启用开关", () => {
  it("setEnabled(true) 启用输入；setEnabled(false) 再次禁用", () => {
    const { input, sendBtn, widget } = setup();
    widget.setEnabled(true);
    expect(input.disabled).toBe(false);
    expect(sendBtn.disabled).toBe(false);
    widget.setEnabled(false);
    expect(input.disabled).toBe(true);
    expect(sendBtn.disabled).toBe(true);
    widget.destroy();
  });
});

describe("createChatWidget — 发送", () => {
  it("未启用时发送 → 触发 onStatus 提示，且不调用 agent.chat", async () => {
    const onStatus = vi.fn();
    const agent = makeAgent();
    const widget = createChatWidget({ container: makeEl(), agent, onStatus });
    await widget.send("现在几点");
    expect(onStatus).toHaveBeenCalledTimes(1);
    expect(agent.chat).not.toHaveBeenCalled();
    widget.destroy();
  });

  it("启用后发送 → 调用 agent.chat，生成期间按钮切为「停止」，结束后恢复", async () => {
    const { agent, widget, sendBtn } = setup();
    widget.setEnabled(true);
    const pending = widget.send("现在几点");
    expect(agent.chat).toHaveBeenCalledTimes(1);
    expect(sendBtn.textContent).toBe("停止");
    await pending;
    expect(sendBtn.textContent).toBe("发送");
    widget.destroy();
  });

  it("生成中再次发送 → 中止当前生成，不重复调用 agent.chat", async () => {
    let resolveChat;
    const agent = makeAgent({
      chat: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveChat = resolve;
          }),
      ),
    });
    const { widget } = setup(agent);
    widget.setEnabled(true);

    const first = widget.send("第一次");
    await Promise.resolve(); // 让 chat 真正被调用
    expect(agent.chat).toHaveBeenCalledTimes(1);

    await widget.send("第二次"); // 应触发 abort 而非新请求
    expect(agent.chat).toHaveBeenCalledTimes(1);

    resolveChat({ answer: "答案", ok: true, steps: [] });
    await first;
    widget.destroy();
  });
});

describe("createChatWidget — 新对话", () => {
  it("clear() 调用 agent.clearHistory，并把日志区重置为欢迎语", async () => {
    const { agent, widget, root } = setup();
    widget.setEnabled(true);
    await widget.send("你好");
    expect(agent.chat).toHaveBeenCalledTimes(1);

    await widget.clear();
    expect(agent.clearHistory).toHaveBeenCalledTimes(1);
    const log = find(root, (n) => hasClass(n, "la-log"));
    expect(log.children.length).toBe(1); // 仅剩欢迎语
    widget.destroy();
  });
});
