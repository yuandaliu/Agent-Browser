/**
 * chatWidget.js — 统一聊天 UI 组件（index / search / demo 三页共用）
 *
 * 背景：三个页面此前各自实现聊天 UI（消息渲染 / 思考过程 / 打字机 / 发送中止），
 * 已出现行为漂移——打字机速度 8 / 12 / 16ms 不一、中止交互不一致，且同类缺陷各犯一次
 * （错误状态类残留、定时器泄漏、Enter 键绕过 disabled 触发并发 chat）。
 * 本组件把这些收敛到一处，页面只需提供容器与 agent 实例。
 *
 * 用法：
 *   const widget = createChatWidget({ container, agent, showAvatar: true });
 *   widget.setEnabled(true);   // 模型就绪后启用输入
 *   widget.send();             // 发送输入框内容（或 widget.send("现在几点")）
 *   widget.clear();            // 新对话
 *   widget.destroy();          // 卸载
 *
 * 主题：通过 CSS 变量定制（见 chatWidget.css 顶部），页面可在容器上覆盖 --la-* 变量。
 */
import "./chatWidget.css";

/** 默认打字机速度（ms/步）；长文本会按 stride 自动加速，不逐字渲染 */
export const DEFAULT_TYPE_SPEED = 12;

/**
 * 创建聊天组件。
 * @param {object} opts
 * @param {HTMLElement} opts.container 挂载容器（组件会替换其内容）
 * @param {object} opts.agent createLocalAgent 实例
 * @param {string} [opts.placeholder] 输入框占位文案
 * @param {number} [opts.typeSpeed=12] 打字机速度（ms/步）
 * @param {boolean} [opts.showAvatar=false] 是否显示头像
 * @param {boolean} [opts.showNewChat=true] 是否显示「新对话」按钮
 * @param {string} [opts.welcomeHtml] 欢迎语（可信 HTML，仅由调用方提供，不接受用户输入）
 * @param {(msg:string)=>void} [opts.onStatus] 状态提示回调（如未加载模型时）
 * @returns {{send:(text?:string)=>Promise<void>, setEnabled:(v:boolean)=>void, clear:()=>Promise<void>, destroy:()=>void, logEl:HTMLElement, isBusy:()=>boolean}}
 */
export function createChatWidget({
  container,
  agent,
  placeholder = "输入消息，Enter 发送，Shift+Enter 换行…",
  typeSpeed = DEFAULT_TYPE_SPEED,
  showAvatar = false,
  showNewChat = true,
  welcomeHtml = "你好，我是本地智能体。加载模型后即可开始提问。",
  onStatus,
} = {}) {
  if (!container) throw new Error("createChatWidget: 缺少 container");
  if (!agent) throw new Error("createChatWidget: 缺少 agent");

  // ---------- 构建 DOM ----------
  const root = document.createElement("div");
  root.className = "la-chat";

  const log = document.createElement("div");
  log.className = "la-log";
  log.setAttribute("aria-live", "polite");

  const inputBar = document.createElement("div");
  inputBar.className = "la-inputbar";

  const input = document.createElement("textarea");
  input.className = "la-input";
  input.rows = 1;
  input.placeholder = placeholder;
  input.disabled = true;

  const actions = document.createElement("div");
  actions.className = "la-actions";

  const newChatBtn = document.createElement("button");
  newChatBtn.className = "la-newchat";
  newChatBtn.type = "button";
  newChatBtn.title = "清空当前对话";
  newChatBtn.textContent = "🔄 新对话";

  const sendBtn = document.createElement("button");
  sendBtn.className = "la-send";
  sendBtn.type = "button";
  sendBtn.textContent = "发送";
  sendBtn.disabled = true;

  if (showNewChat) actions.appendChild(newChatBtn);
  actions.appendChild(sendBtn);
  inputBar.append(input, actions);
  log.appendChild(buildWelcome());
  root.append(log, inputBar);
  // 用 textContent 清空 + appendChild 挂载（而非 replaceChildren）：兼容测试环境的 DOM stub
  container.textContent = "";
  container.appendChild(root);

  // ---------- 状态 ----------
  let enabled = false; // 模型是否就绪（控制输入可用）
  let answering = false; // 对话进行中（防 Enter 键绕过 disabled 触发并发 chat）
  let typeTimer = null; // 打字机定时器（显式持有以便清理）
  let abortController = null; // 中止当前生成

  // ---------- 内部工具 ----------
  function buildWelcome() {
    const w = document.createElement("div");
    w.className = "la-welcome";
    w.innerHTML = welcomeHtml; // 仅接受调用方传入的可信 HTML
    return w;
  }

  function scrollToBottom() {
    log.scrollTop = log.scrollHeight;
  }

  /** 停止打字机并清理定时器（避免新对话/异常后残留定时器操作已移除的节点） */
  function stopTypewriter() {
    if (typeTimer) {
      clearInterval(typeTimer);
      typeTimer = null;
    }
  }

  function clearWelcome() {
    const w = log.querySelector(".la-welcome");
    if (w) w.remove();
  }

  function safeJson(value) {
    try {
      return JSON.stringify(value ?? {});
    } catch {
      return String(value);
    }
  }

  /** 追加一条消息，返回 { msg, body, bubble } */
  function appendBubble(role, text) {
    const msg = document.createElement("div");
    msg.className = `la-msg la-msg-${role}`;
    if (showAvatar) {
      const avatar = document.createElement("div");
      avatar.className = "la-avatar";
      avatar.textContent = role === "user" ? "🧑" : "🤖";
      msg.appendChild(avatar);
    }
    const body = document.createElement("div");
    body.className = "la-body";
    const bubble = document.createElement("div");
    bubble.className = "la-bubble";
    bubble.textContent = text;
    body.appendChild(bubble);
    msg.appendChild(body);
    log.appendChild(msg);
    scrollToBottom();
    return { msg, body, bubble };
  }

  /** 在助手消息的 body 内创建思考过程折叠块 */
  function createStepsBlock(parentBody) {
    const block = document.createElement("div");
    block.className = "la-steps";
    const head = document.createElement("div");
    head.className = "la-steps-head";
    head.textContent = "▾ 思考过程（工具调用）";
    const body = document.createElement("div");
    body.className = "la-steps-body";
    head.addEventListener("click", () => {
      const collapsed = body.classList.toggle("collapsed");
      head.textContent = collapsed ? "▸ 思考过程（工具调用）" : "▾ 思考过程（工具调用）";
    });
    block.append(head, body);
    parentBody.appendChild(block);
    return { block, body };
  }

  // ---------- 发送 ----------
  async function send(prefilled) {
    // 生成中再次触发 → 中止当前生成（发送按钮与 Enter 走同一路径）
    if (answering && abortController) {
      abortController.abort();
      return;
    }
    const text = (prefilled ?? input.value).trim();
    if (!text || answering) return;
    if (!enabled) {
      onStatus?.("请先加载模型再开始对话");
      return;
    }

    answering = true;
    abortController = new AbortController();
    sendBtn.textContent = "停止";
    sendBtn.disabled = false; // 保持可点，用于中止
    input.value = "";
    input.style.height = "auto";
    stopTypewriter();
    clearWelcome();

    appendBubble("user", text);
    const { body: aiBody, bubble } = appendBubble("ai", "…");
    const steps = createStepsBlock(aiBody);
    let rawLine = null;

    const showStream = (full) => {
      if (!full) return;
      if (!rawLine) {
        rawLine = document.createElement("div");
        rawLine.className = "la-raw";
        steps.body.appendChild(rawLine);
      }
      rawLine.textContent = full;
      scrollToBottom();
    };

    try {
      const result = await agent.chat(text, {
        signal: abortController.signal,
        onStep: (step) => {
          switch (step.type) {
            case "stream":
              showStream(step.text);
              break;
            case "action": {
              const line = document.createElement("div");
              line.className = "la-action";
              line.textContent = `🔧 Action: ${step.name} ${safeJson(step.input)}`;
              steps.body.appendChild(line);
              scrollToBottom();
              break;
            }
            case "observation": {
              const line = document.createElement("div");
              line.className = "la-observation";
              line.textContent = `👁 Observation: ${step.result}`;
              steps.body.appendChild(line);
              scrollToBottom();
              break;
            }
            case "error": {
              const line = document.createElement("div");
              line.className = "la-observation la-error-line";
              line.textContent = `⚠️ ${step.message}`;
              steps.body.appendChild(line);
              break;
            }
          }
        },
      });

      // 无工具调用时移除空的思考过程块，避免留下一个空框
      if (steps.body.childElementCount === 0) steps.block.remove();

      const answer = result?.answer ?? "";
      stopTypewriter();
      bubble.classList.remove("streaming");
      if (!answer) {
        bubble.textContent = "（无回答）";
      } else {
        bubble.textContent = "";
        bubble.classList.add("streaming");
        let i = 0;
        const stride = Math.max(1, Math.ceil(answer.length / 240)); // 长文本按步长加速
        typeTimer = setInterval(() => {
          i = Math.min(answer.length, i + stride);
          bubble.textContent = answer.slice(0, i);
          scrollToBottom();
          if (i >= answer.length) {
            stopTypewriter();
            bubble.classList.remove("streaming");
          }
        }, typeSpeed);
      }
    } catch (err) {
      const isAborted = err?.name === "AbortError" || /abort|中止/i.test(err?.message ?? "");
      bubble.classList.remove("streaming");
      bubble.textContent = isAborted ? "（已中止）" : `出错了：${err?.message ?? err}`;
    } finally {
      answering = false;
      abortController = null;
      sendBtn.textContent = "发送";
      sendBtn.disabled = !enabled;
      if (enabled) input.focus();
    }
  }

  // ---------- 事件绑定 ----------
  sendBtn.addEventListener("click", () => send());
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  });
  if (showNewChat) newChatBtn.addEventListener("click", () => clear());

  // ---------- 对外 API ----------
  /** 启用/禁用输入（模型就绪后启用） */
  function setEnabled(value) {
    enabled = Boolean(value);
    input.disabled = !enabled;
    sendBtn.disabled = !enabled || answering;
    if (enabled) input.focus();
  }

  /** 新对话：中止生成、清理定时器、清空历史与日志，并重置状态与按钮 */
  async function clear() {
    stopTypewriter();
    if (abortController) abortController.abort();
    answering = false;
    abortController = null;
    sendBtn.textContent = "发送";
    sendBtn.disabled = !enabled;
    try {
      await agent.clearHistory();
    } catch {
      /* 清空失败不影响 UI 重置 */
    }
    log.textContent = "";
    log.appendChild(buildWelcome());
  }

  /** 卸载组件：停止定时器、中止生成、移除 DOM */
  function destroy() {
    stopTypewriter();
    if (abortController) abortController.abort();
    root.remove();
  }

  setEnabled(false); // 初始态：模型未加载，输入禁用

  return {
    send,
    setEnabled,
    clear,
    destroy,
    logEl: log,
    isBusy: () => answering,
  };
}
