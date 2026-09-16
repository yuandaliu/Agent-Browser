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

/**
 * 正文候选容器（pickMainContent 遍历这些 selector，**打分**取分数最高的，
 * 不是按顺序匹配第一个）。打分逻辑在 scoreCandidate()：
 *   score = 文本密度（1 - linkText/totalText） × 长度权重（min(total/800, 1.5)）
 * 分数 >= 0.25 才算"够格"，否则回退到 body 整页读取。
 */
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
let observerRefCount = 0;
let popstateHandler = null;
let pushStatePatched = false;
let replaceStatePatched = false;
// 共享 bootstrap 句柄：所有 caller 共用一个 DOMContentLoaded 监听器，
// 第一次触发时调用 initPageWatcher 创建 observer，避免重复监听或重复 init。
let sharedBootstrap = null;
let sharedBootstrapOptions = null; // 第一个 caller 的 { debounceMs, maxChars }
let pendingCallerCount = 0; // body 未就绪时的 caller 数量（用于 dispose 时是否真 remove）

function refreshCache(maxChars) {
  try {
    const root = pickMainContent() ?? document.body;
    const raw = extractVisibleText(root);
    cache = {
      version: cache.version + 1,
      text: truncateText(raw, maxChars),
      rawLength: raw.length,
      updatedAt: Date.now(),
    };
  } catch {
    /* DOM 读取失败时保留旧缓存 */
  }
}

/**
 * 启动页面实时监听：DOM 变化（防抖）与 SPA 路由变化时刷新正文缓存。
 * 多实例安全：底层 observer / cache 为单例（页面只有一个），但每个调用方拿到独立的
 * dispose 句柄，引用计数归零才真正 disconnect，避免一个实例 dispose 误伤其他实例。
 * 返回控制器 { getSnapshot, dispose }。
 */
export function initPageWatcher({ debounceMs = 600, maxChars = DEFAULT_MAX_CHARS } = {}) {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return null;
  }

  // 首次初始化创建 observer 与路由 patch；后续调用只增加引用计数
  if (!observer) {
    // body 尚未就绪（脚本在 <head> 中执行，宿主页面常见）时延迟到 DOMContentLoaded
    // 再初始化，避免 observe(null) 抛 TypeError 中断宿主页面初始化流程。
    // 多 caller 安全：所有 caller 共享一个 DOMContentLoaded 监听器，body 就绪后
    // 只用第一个 caller 的配置创建 observer（后续 caller 共享这个 observer）。
    if (!document.body) {
      pendingCallerCount++;
      if (!sharedBootstrap) {
        sharedBootstrapOptions = { debounceMs, maxChars };
        sharedBootstrap = () => {
          // 关键：触发时把 pendingCallerCount 转成 observerRefCount 的增量，
          // 让总引用计数 = 实际 caller 数。后续 dispose 走 observer 路径才能正确归零。
          // 修复前是直接递归 initPageWatcher 再清 sharedBootstrap，observerRefCount
          // 只记 1 而 pending caller 没被计入，dispose 永远减不到 0 → observer 泄漏。
          const options = sharedBootstrapOptions;
          const pending = pendingCallerCount;
          pendingCallerCount = 0;
          sharedBootstrap = null;
          sharedBootstrapOptions = null;
          if (typeof document !== "undefined" && document.body) {
            // 递归调用走"body 已就绪"分支，会创建 observer 并 observerRefCount++ (→ 1)
            initPageWatcher(options);
            // 把原本 pending 的 caller 数量补上（initPageWatcher 已 +1，这里 +pending-1）
            observerRefCount += pending - 1;
          }
        };
        document.addEventListener("DOMContentLoaded", sharedBootstrap, { once: true });
      }
      return {
        getSnapshot: (opts) => getPageSnapshot(opts),
        dispose: () => {
          // 路径 1：observer 已创建（sharedBootstrap 已触发过）→ 按引用计数释放
          if (observer) {
            observerRefCount = Math.max(0, observerRefCount - 1);
            if (observerRefCount === 0) {
              observer?.disconnect();
              observer = null;
              if (refreshTimer) {
                clearTimeout(refreshTimer);
                refreshTimer = null;
              }
              if (popstateHandler && typeof window !== "undefined") {
                window.removeEventListener("popstate", popstateHandler);
                popstateHandler = null;
              }
            }
            return;
          }
          // 路径 2：bootstrap 阶段（DOMContentLoaded 还没触发）→ 减 pending 计数，
          // 全 dispose 时移除共享 listener
          if (pendingCallerCount > 0) {
            pendingCallerCount--;
            if (pendingCallerCount === 0 && sharedBootstrap && typeof document !== "undefined") {
              document.removeEventListener("DOMContentLoaded", sharedBootstrap);
              sharedBootstrap = null;
              sharedBootstrapOptions = null;
            }
          }
        },
      };
    }
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => refreshCache(maxChars), debounceMs);
    };

    observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    if (typeof window !== "undefined") {
      popstateHandler = scheduleRefresh;
      window.addEventListener("popstate", popstateHandler);
    }
    // patch pushState + replaceState 覆盖 SPA 路由切换（幂等，只 patch 一次）
    if (!pushStatePatched && typeof history !== "undefined" && typeof history.pushState === "function") {
      const original = history.pushState;
      history.pushState = function (...args) {
        const result = original.apply(this, args);
        scheduleRefresh();
        return result;
      };
      pushStatePatched = true;
    }
    if (!replaceStatePatched && typeof history !== "undefined" && typeof history.replaceState === "function") {
      const original = history.replaceState;
      history.replaceState = function (...args) {
        const result = original.apply(this, args);
        scheduleRefresh();
        return result;
      };
      replaceStatePatched = true;
    }

    refreshCache(maxChars); // 初始快照
  }

  observerRefCount++;

  // 返回独立控制器：dispose 只减引用计数，归零才真正释放底层资源
  return {
    getSnapshot: (opts) => getPageSnapshot(opts),
    dispose: () => {
      observerRefCount = Math.max(0, observerRefCount - 1);
      if (observerRefCount === 0) {
        observer?.disconnect();
        observer = null;
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }
        if (popstateHandler && typeof window !== "undefined") {
          window.removeEventListener("popstate", popstateHandler);
          popstateHandler = null;
        }
      }
    },
  };
}

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
      const rawLen = cache.rawLength ?? cache.text.length;
      return {
        ok: true,
        title: document.title,
        url: location.href,
        text: cache.text,
        length: rawLen,
        source: "cache",
        updatedAt: cache.updatedAt,
        truncated: rawLen > maxChars,
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
