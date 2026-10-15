/**
 * main.js — 应用入口：模型面板 + 统一聊天组件
 *
 * 聊天 UI 由 src/chatWidget.js 统一渲染（与 search / demo 页共用同一实现，
 * 消除此前三份实现的行为漂移），本文件只负责模型面板与事件组装。
 */
import { createLocalAgent, getModelOptions, getDefaultModelId } from "./embed.js";
import { createChatWidget } from "./chatWidget.js";

// ---------------------------------------------------------------------------
// DOM 引用
//
// 必须在创建 agent 之前完成：createLocalAgent 的 ready() 会在解析过程中同步触发
// hardware 事件，若此时 el 尚未初始化，回调里的访问会抛 TDZ 错误，且该错误会被 SDK
// 内部的 try/catch 静默吞掉——表现为「硬件徽章不更新」这类难查的现象。
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
  chatWidget: document.getElementById("chat-widget"),
};

// ---------------------------------------------------------------------------
// 智能体 + 聊天组件
// ---------------------------------------------------------------------------

const agent = createLocalAgent({ onEvent: handleModelEvent });

const widget = createChatWidget({
  container: el.chatWidget,
  agent,
  showAvatar: true,
  welcomeHtml:
    '<div class="la-welcome-icon">🤖</div>' +
    "<h2>你好，我是本地智能体</h2>" +
    "<p>我的模型完全运行在你的浏览器里（WebGPU），不上传对话。<br />先点击左侧「加载模型」，然后就可以开始对话了。</p>",
  onStatus: (msg) => {
    el.errorBox.textContent = msg;
    el.errorBox.classList.remove("hidden");
  },
});

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

export function handleModelEvent(event) {
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
    case "model-recommended": {
      // 硬件推荐档 → 写回下拉（与 demo/embed-demo.html 的既有实现一致）。
      // 该事件在 "auto" 档位下由 ready() 触发一次，此后不再触发，所以直接覆盖即可，
      // 不需要"用户手动改过就不再覆盖"的标志位——事件到达时用户还没机会改。
      //
      // ⚠️ 时序契约：本分支依赖"下拉选项已经渲染完毕"（本文件末的 `await agent.ready()` 在
      //    第 56-62 行的下拉填充之后才执行）。若将来把 ready() 提前、或让 chatWidget 之类
      //    的组件去调 agent.ready()，`select.value = ...` 会因为 DOM 中尚无对应 <option>
      //    而被静默写成空串——「加载模型」随后落到 FALLBACK_MODEL_ID（又是 0.8B），
      //    症状是"设备自适应莫名其妙又失效了"，但代码看起来没问题。
      //    下面这层 getModelOptions() 校验只挡"id 不在档位表"，挡不住"option 尚未渲染"。
      //
      // 修复前：推荐结果只发事件而无人消费，而「加载模型」读的正是下拉当前值（初始为最低档
      // 0.8B），于是"设备自适应"形同虚设（REVIEW.md A5）。
      const recommended = getModelOptions().find((m) => m.id === event.modelId);
      if (recommended) {
        el.modelSelect.value = event.modelId;
        el.modelSelect.title = `为你的设备推荐：${recommended.label}`;
      }
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
      el.modelBadge.textContent = `已加载：${friendlyModelName(event.modelId)}`;
      el.modelBadge.className = "badge badge-ok";
      el.loadBtn.textContent = "已就绪 ✓";
      el.loadBtn.disabled = true;
      widget.setEnabled(true); // 模型就绪 → 启用聊天输入
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

/**
 * 从模型 id 取最后一段（"owner/repo" → "repo"）。纯函数，导出以便单测。
 */
export function shortModelName(id) {
  return id.split("/").pop() ?? id;
}

/**
 * 友好的模型名：优先取 MODEL_OPTIONS 中 label 的主名（"（" 之前），
 * 未知 id 降级到 shortModelName。纯函数，导出以便单测。
 */
export function friendlyModelName(id) {
  const opt = getModelOptions().find((m) => m.id === id);
  if (!opt) return shortModelName(id);
  return opt.label.split("（")[0].trim();
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
// 初始化
// ---------------------------------------------------------------------------

try {
  await agent.ready();
} catch (err) {
  console.error("[app] 智能体初始化失败:", err);
}
