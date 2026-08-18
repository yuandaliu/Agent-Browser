/**
 * main.js — 应用入口：组装模型加载、ReAct 循环、工具、记忆与 UI
 */
import { BrowserAI } from "@missionsquad/browserai";
import { getMemoryStore } from "./memory.js";
import { createModelLoader, getModelOptions, getDefaultModelId } from "./modelLoader.js";
import { runAgent } from "./agentLoop.js";

// ---------------------------------------------------------------------------
// 初始化
// ---------------------------------------------------------------------------

/** 部署模式：本地开发走 Vite 代理 + verifyProxy；托管平台依赖 rewrites 转发到镜像 */
const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);

const ai = new BrowserAI({
  modelSource: "proxy", // 模型文件经页面同源 /hf*、/gh-raw* 路由下载
  proxyOrigin: undefined, // 默认页面 origin（同源，避免 CORS 与混合内容问题）
  verifyProxy: isLocalhost, // 本地代理提供 X-Proxy-Worker 健康检查；托管平台由配置保证
  webllm: { logLevel: "INFO" },
  cacheBackend: "indexeddb", // WebLLM 权重缓存到 IndexedDB
});

const memory = await getMemoryStore();
const loader = createModelLoader({ browserAI: ai, onEvent: handleModelEvent });

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
      console.log("✅ 模型已就绪:", event.modelId); // 验收：控制台输出“模型已就绪”
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
    await loader.load(modelId);
  } catch (err) {
    console.error("[app] 模型加载失败:", err);
  } finally {
    el.loadBtn.disabled = !loader.isBusy() && !loader.getLoadedModelId();
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
// 发送
// ---------------------------------------------------------------------------

let sending = false;

async function handleSend() {
  const text = el.inputBox.value.trim();
  if (!text || sending) return;
  if (!loader.getLoadedModelId()) {
    el.errorBox.textContent = "请先加载模型再开始对话。";
    el.errorBox.classList.remove("hidden");
    return;
  }

  sending = true;
  el.sendBtn.disabled = true;
  el.inputBox.value = "";

  // 渲染用户消息 + 持久化
  appendMessage("user", text);
  await memory.addMessage("user", text).catch(() => {});

  // 助手消息骨架
  const { bubble } = appendMessage("ai", "…");

  let finalAnswer = "";
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
    const result = await runAgent({
      userInput: text,
      memory,
      generate: async (messages, { onDelta }) => {
        return ai.generateText(messages, {
          runtime: { maxTokens: 768 },
          onDelta,
        });
      },
      onStep,
    });
    finalAnswer = result.answer;

    // 确保最终答案已渲染（若未走到 final 步骤）
    if (stopTypewriter) stopTypewriter();
    if (bubble.textContent !== finalAnswer) {
      bubble.textContent = finalAnswer;
      bubble.classList.remove("streaming");
    }
    await memory.addMessage("assistant", finalAnswer).catch(() => {});
    console.log(`[app] 完成（${result.steps.length} 步）：`, finalAnswer);
  } catch (err) {
    console.error("[app] 对话失败:", err);
    bubble.textContent = `出错了：${err?.message ?? err}`;
    bubble.classList.remove("streaming");
  } finally {
    endStepsBlock();
    sending = false;
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
  await memory.clearHistory().catch(() => {});
  el.chatLog.innerHTML = "";
  const welcome = document.createElement("div");
  welcome.className = "welcome";
  welcome.innerHTML = `<div class="welcome-icon">🤖</div><h2>新对话已开始</h2><p>模型仍然保持加载，随时可以继续提问。</p>`;
  el.chatLog.appendChild(welcome);
  console.log("[app] 已清空对话历史");
});

// ---------------------------------------------------------------------------
// 启动时 WebGPU 预检
// ---------------------------------------------------------------------------

(async () => {
  try {
    const snapshot = await ai.probeHardware();
    const ok = snapshot.webgpuSupported;
    el.hardwareBadge.textContent = ok ? "WebGPU ✓" : "WebGPU ✗";
    el.hardwareBadge.className = `badge ${ok ? "badge-ok" : "badge-err"}`;
    if (!ok) {
      el.errorBox.textContent = `当前浏览器不支持 WebGPU（${snapshot.webgpuReason ?? "未知原因"}），无法运行本地模型。请使用最新 Chrome/Edge。`;
      el.errorBox.classList.remove("hidden");
    }
    console.log("[app] WebGPU 检测:", ok ? "支持" : "不支持", snapshot.webgpuReason ?? "");
  } catch (err) {
    console.warn("[app] WebGPU 检测失败:", err);
  }
})();
