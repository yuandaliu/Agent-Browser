/**
 * main.js — 应用入口：基于 embed.js 的组件 API 组装 UI
 *
 * 重构说明：核心流程（模型加载 / ReAct 循环 / 历史保存 / 页面监听）统一收敛到
 * createLocalAgent，本文件只负责 DOM 渲染与事件绑定，消除此前与 embed.js 的双套状态机。
 */
import { createLocalAgent, getModelOptions, getDefaultModelId } from "./embed.js";

// ---------------------------------------------------------------------------
// 初始化：创建智能体实例并 ready（内部完成 IndexedDB 降级 + WebGPU 预检 + 页面监听）
// ---------------------------------------------------------------------------

const agent = createLocalAgent({ onEvent: handleModelEvent });
try {
  await agent.ready();
} catch (err) {
  console.error("[app] 智能体初始化失败:", err);
}

// ---------------------------------------------------------------------------
// DOM 引用
// ---------------------------------------------------------------------------

const el = {
  modelSelect: document.getElementById("model-select"),
  loadBtn: document.getElementById("load-btn"),
  progressWrap: document.getElementById("progress-wrap"),
  progressBar: document.getElementById("progress-bar"),
  progressPct: document.getElementById("progress-pct"),
  progressStatus: document.getElementById("progress-status"),
  readyBox: document.getElementById("model-ready"),
  errorBox: document.getElementById("error-box"),
  hardwareBadge: document.getElementById("hardware-badge"),
  modelBadge: document.getElementById("model-badge"),
  chatLog: document.getElementById("chat-log"),
  inputBox: document.getElementById("input-box"),
  sendBtn: document.getElementById("send-btn"),
  newChatBtn: document.getElementById("new-chat-btn"),
};

// ---------------------------------------------------------------------------
// 模型下拉
// ---------------------------------------------------------------------------

for (const option of getModelOptions()) {
  const opt = document.createElement("option");
  opt.value = option.id;
  opt.textContent = option.label;
  el.modelSelect.appendChild(opt);
}
el.modelSelect.value = getDefaultModelId();

// ---------------------------------------------------------------------------
// 模型加载事件 → UI
// ---------------------------------------------------------------------------

let maxProgress = 0;

function handleModelEvent(event) {
  switch (event.type) {
    case "hardware": {
      const ok = event.snapshot.webgpuSupported;
      el.hardwareBadge.textContent = ok ? "WebGPU ✓" : "WebGPU ✗";
      el.hardwareBadge.className = `badge ${ok ? "badge-ok" : "badge-err"}`;
      if (!ok) {
        el.errorBox.textContent = `当前浏览器不支持 WebGPU（${event.snapshot.webgpuReason ?? "未知原因"}），无法运行本地模型。请使用最新 Chrome/Edge。`;
        el.errorBox.classList.remove("hidden");
      }
      break;
    }
    case "progress": {
      const pct = Math.round(event.progress * 100);
      maxProgress = Math.max(maxProgress, pct);
      el.progressBar.style.width = `${maxProgress}%`;
      el.progressPct.textContent = `${maxProgress}%`;
      if (event.status) el.progressStatus.textContent = event.status;
      if (event.file) el.progressStatus.textContent = event.file;
      break;
    }
    case "status": {
      el.progressStatus.textContent = event.message;
      break;
    }
    case "ready": {
      el.progressBar.style.width = "100%";
      el.progressPct.textContent = "100%";
      el.progressStatus.textContent = "加载完成";
      el.readyBox.classList.remove("hidden");
      el.modelBadge.textContent = `已加载：${shortModelName(event.modelId)}`;
      el.modelBadge.className = "badge badge-ok";
      el.loadBtn.textContent = "已就绪 ✓";
      el.loadBtn.disabled = true;
      el.inputBox.disabled = false;
      el.sendBtn.disabled = false;
      console.log("✅ 模型已就绪:", event.modelId); // 验收：控制台输出"模型已就绪"
      break;
    }
    case "error": {
      el.errorBox.textContent = event.error?.message ?? String(event.error);
      el.errorBox.classList.remove("hidden");
      el.loadBtn.textContent = "重试加载";
      el.loadBtn.disabled = false;
      break;
    }
  }
}

function shortModelName(id) {
  return id.split("/").pop() ?? id;
}

// ---------------------------------------------------------------------------
// 加载按钮
// ---------------------------------------------------------------------------

el.loadBtn.addEventListener("click", async () => {
  el.errorBox.classList.add("hidden");
  el.readyBox.classList.add("hidden");
  maxProgress = 0;
  el.progressWrap.classList.remove("hidden");
  el.loadBtn.disabled = true;
  el.loadBtn.textContent = "加载中…";
  const modelId = el.modelSelect.value;
  console.log(`[app] 开始加载模型: ${modelId}`);
  try {
    await agent.load(modelId);
  } catch (err) {
    console.error("[app] 模型加载失败:", err);
  }
});

// ---------------------------------------------------------------------------
// 聊天渲染
// ---------------------------------------------------------------------------

function appendMessage(role, content) {
  const wrapper = document.createElement("div");
  wrapper.className = `msg msg-${role}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "user" ? "🧑" : "🤖";

  const body = document.createElement("div");
  body.className = "msg-body";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = content;

  body.appendChild(bubble);
  wrapper.appendChild(avatar);
  wrapper.appendChild(body);
  el.chatLog.appendChild(wrapper);
  scrollToBottom();
  return { wrapper, bubble };
}

/** 创建（或复用）助手消息的思考过程折叠区 */
let currentStepsBlock = null;

function startStepsBlock() {
  if (currentStepsBlock) return currentStepsBlock;

  const container = document.createElement("div");
  container.className = "msg msg-ai";
  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "🤖";
  const body = document.createElement("div");
  body.className = "msg-body";

  const block = document.createElement("div");
  block.className = "steps-block";

  const head = document.createElement("div");
  head.className = "steps-head";
  const caret = document.createElement("span");
  caret.className = "caret";
  caret.textContent = "▾";
  const label = document.createElement("span");
  label.textContent = "思考过程（Thought / Action / Observation）";
  head.append(caret, label);

  const stepsBody = document.createElement("div");
  stepsBody.className = "steps-body";

  head.addEventListener("click", () => {
    const collapsed = stepsBody.classList.toggle("collapsed");
    caret.textContent = collapsed ? "▸" : "▾";
  });

  block.append(head, stepsBody);
  body.appendChild(block);
  container.append(avatar, body);
  el.chatLog.appendChild(container);
  scrollToBottom();

  currentStepsBlock = { block, stepsBody };
  return currentStepsBlock;
}

function endStepsBlock() {
  currentStepsBlock = null;
}

function addStepLine(type, text) {
  const { stepsBody } = startStepsBlock();
  const line = document.createElement("div");
  line.className = `step-line step-${type}`;
  line.innerHTML = "";
  if (type === "action") {
    const tag = document.createElement("span");
    tag.className = "step-tag";
    tag.textContent = "🔧 Action";
    line.append(tag, document.createTextNode(` ${text}`));
  } else if (type === "observation") {
    const tag = document.createElement("span");
    tag.className = "step-tag";
    tag.textContent = "👁 Observation";
    line.append(tag, document.createTextNode(` ${text}`));
  } else if (type === "error") {
    const tag = document.createElement("span");
    tag.className = "step-tag";
    tag.textContent = "⚠️";
    line.append(tag, document.createTextNode(` ${text}`));
  } else {
    line.textContent = text;
  }
  stepsBody.appendChild(line);
  scrollToBottom();
}

function addRawStreamLine(text) {
  const { stepsBody } = startStepsBlock();
  let raw = stepsBody.querySelector(".step-raw");
  if (!raw) {
    raw = document.createElement("div");
    raw.className = "step-raw";
    stepsBody.appendChild(raw);
  }
  raw.textContent = text;
  scrollToBottom();
}

/** 最终答案打字机流式渲染 */
function typeWriter(bubble, text, onDone) {
  bubble.classList.add("streaming");
  let index = 0;
  const SPEED = 8; // ms / 字符
  const timer = setInterval(() => {
    index += 1;
    bubble.textContent = text.slice(0, index);
    scrollToBottom();
    if (index >= text.length) {
      clearInterval(timer);
      bubble.classList.remove("streaming");
      onDone?.();
    }
  }, SPEED);
  return () => clearInterval(timer);
}

function scrollToBottom() {
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
}

// ---------------------------------------------------------------------------
// 发送：委托给 agent.chat，历史与失败落库由 embed 内部统一处理
// ---------------------------------------------------------------------------

let sending = false;
let abortController = null;

async function handleSend() {
  // 正在发送中再次点击 sendBtn → 中止当前对话
  if (sending && abortController) {
    abortController.abort();
    return;
  }
  const text = el.inputBox.value.trim();
  if (!text) return;
  if (!agent.getLoadedModelId()) {
    el.errorBox.textContent = "请先加载模型再开始对话。";
    el.errorBox.classList.remove("hidden");
    return;
  }

  sending = true;
  abortController = new AbortController();
  el.sendBtn.textContent = "停止";
  el.sendBtn.disabled = false; // 保持可点击，用于中止
  el.inputBox.value = "";

  // 渲染用户消息 + 助手消息骨架（user 消息由 agent.chat 内部持久化）
  appendMessage("user", text);
  const { bubble } = appendMessage("ai", "…");

  let stopTypewriter = null;

  const onStep = (step) => {
    switch (step.type) {
      case "stream":
        addRawStreamLine(step.text);
        break;
      case "raw":
        break;
      case "action": {
        let pretty;
        try {
          pretty = JSON.stringify(step.input, null, 0);
        } catch {
          pretty = String(step.input);
        }
        addStepLine("action", `${step.name} ${pretty}`);
        break;
      }
      case "observation":
        addStepLine("observation", step.result);
        break;
      case "final":
        if (stopTypewriter) stopTypewriter();
        stopTypewriter = typeWriter(bubble, step.text, () => {});
        break;
      case "error":
        addStepLine("error", step.message);
        break;
    }
  };

  try {
    const result = await agent.chat(text, { onStep, signal: abortController.signal });
    const finalAnswer = result.answer;
    // 确保最终答案已渲染（若未走到 final 步骤）
    if (stopTypewriter) stopTypewriter();
    if (bubble.textContent !== finalAnswer) {
      bubble.textContent = finalAnswer;
      bubble.classList.remove("streaming");
    }
    console.log(`[app] 完成（${result.steps.length} 步，ok=${result.ok !== false}）：`, finalAnswer);
  } catch (err) {
    const isAborted = err?.name === "AbortError" || /abort|中止/i.test(err?.message ?? "");
    console.error("[app] 对话失败:", err);
    bubble.textContent = isAborted ? "（已中止）" : `出错了：${err?.message ?? err}`;
    bubble.classList.remove("streaming");
  } finally {
    if (stopTypewriter) stopTypewriter();
    endStepsBlock();
    sending = false;
    abortController = null;
    el.sendBtn.textContent = "发送";
    el.sendBtn.disabled = false;
    el.inputBox.focus();
    scrollToBottom();
  }
}

el.sendBtn.addEventListener("click", handleSend);
el.inputBox.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
});
el.inputBox.addEventListener("input", () => {
  el.inputBox.style.height = "auto";
  el.inputBox.style.height = `${Math.min(el.inputBox.scrollHeight, 140)}px`;
});

// ---------------------------------------------------------------------------
// 新对话
// ---------------------------------------------------------------------------

el.newChatBtn.addEventListener("click", async () => {
  await agent.clearHistory().catch(() => {});
  el.chatLog.innerHTML = "";
  const welcome = document.createElement("div");
  welcome.className = "welcome";
  welcome.innerHTML = `<div class="welcome-icon">🤖</div><h2>新对话已开始</h2><p>模型仍然保持加载，随时可以继续提问。</p>`;
  el.chatLog.appendChild(welcome);
  console.log("[app] 已清空对话历史");
});
