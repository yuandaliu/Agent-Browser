/**
 * pageReader.js — 当前页面实时内容读取器
 *
 * 能力（对应方案 A+B+C）：
 *   A. 快照读取：getPageSnapshot() 返回当前页面标题 / URL / 可见文本（智能截断）
 *   B. 正文提取：优先 <article>/<main>/role=main 等语义容器，按"文本密度"启发式
 *      评分选取内容块，剔除导航/页脚/表单等噪声
 *   C. 实时缓存：MutationObserver 监听 DOM 变化（防抖），维护最新正文快照；
 *      popstate / history.pushState 拦截覆盖 SPA 路由切换
 *
 * 安全：只读可见文本，不读取表单值、不修改任何 DOM。
 * 边界：在 Node/Worker 等无 document 环境返回可读错误；iframe 跨域场景由
 *       宿主通过 postMessage 推送内容（见 INTEGRATION.md）。
 */

/** 快照最大字符数（控制注入模型的上下文开销） */
export const DEFAULT_MAX_CHARS = 4000;

/** 排除的噪声元素（不读取其文本）；[data-local-agent-ui] 为智能体自身 UI（弹窗/悬浮球/聊天区） */
const EXCLUDED_SELECTOR =
  'script, style, noscript, iframe, svg, canvas, audio, video, template, input, textarea, select, button, [aria-hidden="true"], .sr-only, [hidden], [data-local-agent-ui]';

/** selector 命中区域文本低于该长度视为"内容过少"，自动回退整页读取 */
export const SELECTOR_FALLBACK_MIN_CHARS = 40;

/** 正文候选容器（按优先级） */
const CONTENT_CANDIDATES = [
  "article",
  "main",
  '[role="main"]',
  ".article",
  ".post",
  ".content",
  "#content",
  ".main-content",
  ".entry-content",
];

// ---------------------------------------------------------------------------
// 纯逻辑（可在 Node 中单测）
// ---------------------------------------------------------------------------

/**
 * 文本密度评分：0-1，越高越像正文。
 * 正文的链接文本占比低；导航/列表的链接文本占比高。
 * 参数接受 { totalText, linkText }（字符串或长度），便于脱离 DOM 测试。
 */
export function textDensityScore({ totalText = 0, linkText = 0 } = {}) {
  const total = typeof totalText === "number" ? totalText : String(totalText ?? "").trim().length;
  const links = typeof linkText === "number" ? linkText : String(linkText ?? "").trim().length;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (total - links) / total));
}

/**
 * 智能截断：保留开头 60% + 结尾，中间以截断标记连接。
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
export function truncateText(text, maxChars = DEFAULT_MAX_CHARS) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  const marker = "\n…[内容已截断，仅保留首尾]…\n";
  const head = Math.floor(maxChars * 0.6);
  const tail = Math.max(maxChars - head - marker.length, 40);
  return text.slice(0, head) + marker + text.slice(-tail);
}

// ---------------------------------------------------------------------------
// DOM 相关（浏览器环境）
// ---------------------------------------------------------------------------

/** 从根元素提取可见文本（跳过噪声元素与表单值） */
function extractVisibleText(root) {
  if (typeof document === "undefined") return "";
  const parts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent) continue;
    if (parent.closest(EXCLUDED_SELECTOR)) continue;
    const text = node.textContent.replace(/\s+/g, " ").trim();
    if (text) parts.push(text);
  }
  return parts.join("\n");
}

/** 候选元素的正文评分（文本密度 × 长度权重） */
function scoreCandidate(el) {
  const total = (el.textContent ?? "").trim().length;
  let linkText = 0;
  el.querySelectorAll("a").forEach((a) => {
    linkText += (a.textContent ?? "").trim().length;
  });
  const density = textDensityScore({ totalText: total, linkText });
  // 长度权重：正文一般 > 200 字符；过长不额外加分
  const lengthWeight = Math.min(total / 800, 1.5);
  return density * lengthWeight;
}

/** 启发式选取正文容器；找不到合适容器时退回 body */
export function pickMainContent(doc = null) {
  const documentRef = doc ?? (typeof document !== "undefined" ? document : null);
  if (!documentRef) return null;
  let best = null;
  let bestScore = 0;
  for (const selector of CONTENT_CANDIDATES) {
    for (const el of documentRef.querySelectorAll(selector)) {
      const score = scoreCandidate(el);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
  }
  if (best && bestScore >= 0.25) return best;
  return documentRef.body;
}

// ---------------------------------------------------------------------------
// 实时缓存（MutationObserver）
// ---------------------------------------------------------------------------

let cache = { version: 0, text: "", updatedAt: 0 };
let refreshTimer = null;
let observer = null;
let pushStatePatched = false;

function refreshCache(maxChars) {
  try {
    const root = pickMainContent() ?? document.body;
    const text = extractVisibleText(root);
    cache = { version: cache.version + 1, text, updatedAt: Date.now() };
  } catch {
    /* DOM 读取失败时保留旧缓存 */
  }
}

/**
 * 启动页面实时监听：DOM 变化（防抖）与 SPA 路由变化时刷新正文缓存。
 * 幂等，可重复调用。返回控制器 { getSnapshot, dispose }。
 */
export function initPageWatcher({ debounceMs = 600, maxChars = DEFAULT_MAX_CHARS } = {}) {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return null;
  }
  if (observer) return pageWatcherApi;

  const scheduleRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refreshCache(maxChars), debounceMs);
  };

  observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  if (typeof window !== "undefined") {
    window.addEventListener("popstate", scheduleRefresh);
  }
  if (!pushStatePatched && typeof history !== "undefined" && typeof history.pushState === "function") {
    const original = history.pushState;
    history.pushState = function (...args) {
      const result = original.apply(this, args);
      scheduleRefresh();
      return result;
    };
    pushStatePatched = true;
  }

  refreshCache(maxChars); // 初始快照

  return pageWatcherApi;
}

const pageWatcherApi = {
  getSnapshot: (opts) => getPageSnapshot(opts),
  dispose: () => {
    observer?.disconnect();
    observer = null;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
  },
};

/**
 * 读取当前页面内容快照。
 * @param {object} [opts]
 * @param {string|null} [opts.selector] CSS 选择器：指定时实时读取该区域；
 *        未找到或内容过少时自动回退为整页读取（并附 note 说明）
 * @param {number} [opts.maxChars=4000] 截断上限
 * @returns {{ok:boolean, title?:string, url?:string, text?:string, length?:number, source?:string, truncated?:boolean, note?:string, error?:string}}
 */
export function getPageSnapshot({ selector = null, maxChars = DEFAULT_MAX_CHARS } = {}) {
  if (typeof document === "undefined" || typeof location === "undefined") {
    return { ok: false, error: "当前不在浏览器页面环境中，无法读取页面内容。" };
  }

  /** 整页读取：优先 MutationObserver 维护的实时缓存 */
  const readWholePage = () => {
    if (cache.version > 0) {
      return {
        ok: true,
        title: document.title,
        url: location.href,
        text: cache.text,
        length: cache.text.length,
        source: "cache",
        updatedAt: cache.updatedAt,
        truncated: cache.text.length > 0 && cache.text.length >= DEFAULT_MAX_CHARS * 0.9,
      };
    }
    const root = pickMainContent() ?? document.body;
    const raw = extractVisibleText(root);
    const text = truncateText(raw, maxChars);
    return {
      ok: true,
      title: document.title,
      url: location.href,
      text,
      length: raw.length,
      source: root.tagName.toLowerCase(),
      truncated: text.length < raw.length,
    };
  };

  if (selector) {
    // 指定区域：实时精确读取
    const root = document.querySelector(selector);
    if (!root) {
      // 选择器未命中：自动回退整页，避免模型在错误选择器上空转浪费步数
      return { ...readWholePage(), note: `未找到选择器 "${selector}" 对应的元素，已自动读取整个页面。` };
    }
    const raw = extractVisibleText(root);
    if (raw.trim().length < SELECTOR_FALLBACK_MIN_CHARS) {
      // 命中区域内容过少（如导航/按钮）：同样回退整页并说明
      return {
        ...readWholePage(),
        note: `选择器 "${selector}" 对应区域内容过少，已自动读取整个页面。`,
      };
    }
    const text = truncateText(raw, maxChars);
    return {
      ok: true,
      title: document.title,
      url: location.href,
      text,
      length: raw.length,
      source: selector,
      truncated: text.length < raw.length,
    };
  }

  return readWholePage();
}
