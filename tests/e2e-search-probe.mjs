/**
 * e2e-search-probe.mjs — 智能搜索页（仿百度 + 悬浮球聊天弹窗）验证
 * 验证：页面主体展示、悬浮球开合、弹窗尺寸（600px 宽 / 70vh 高）、
 *       智能体嵌入初始化、加载流程 UI、错误处理、未加载状态、控制台零报错
 * 用法：node tests/e2e-search-probe.mjs <url>
 */
import { launchBrowser, collectConsole, waitFor } from "./e2e-helpers.mjs";

const url = process.argv[2] ?? "http://127.0.0.1:5189/search.html";
const browser = await launchBrowser({ headless: true });
const page = await browser.newPage();
const { errors, warnings, logs } = collectConsole(page);

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  // 1) 仿百度页面主体（展示用）
  await waitFor(() => page.locator(".search-input").isVisible(), { label: "搜索框可见" });
  const layout = await page.evaluate(() => ({
    logo: !!document.querySelector(".logo"),
    searchInputReadonly: document.querySelector("#q")?.readOnly,
    nav: document.querySelectorAll(".nav a").length,
    footer: !!document.querySelector("footer"),
    fab: !!document.querySelector("#agent-fab"),
    panel: !!document.querySelector("#agent-panel"),
  }));
  record(
    "仿百度页面主体完整（logo/只读搜索框/导航/页脚）",
    layout.logo && layout.searchInputReadonly && layout.nav >= 4 && layout.footer,
    JSON.stringify(layout),
  );

  // 2) 悬浮球可见
  await waitFor(() => page.locator("#agent-fab").isVisible(), { label: "悬浮球可见" });
  record("悬浮球可见", true);

  // 3) 点击悬浮球 → 弹窗打开，且弹窗隐藏悬浮球
  await page.click("#agent-fab");
  await waitFor(() => page.locator("#agent-panel").evaluate((el) => el.classList.contains("open")), { label: "弹窗打开" });
  const fabHidden = await page.locator("#agent-fab").evaluate((el) => el.style.display === "none" || getComputedStyle(el).display === "none");
  record("点击悬浮球弹出聊天弹窗", true, fabHidden ? "弹窗打开时悬浮球隐藏" : "");

  // 4) 弹窗尺寸：宽度 600px、高度 = 视口 70%
  const size = await page.evaluate(() => {
    const rect = document.getElementById("agent-panel").getBoundingClientRect();
    return { width: rect.width, height: rect.height, vh70: window.innerHeight * 0.7 };
  });
  const widthOk = Math.abs(size.width - 600) < 2;
  const heightOk = Math.abs(size.height - size.vh70) < Math.max(4, size.vh70 * 0.02);
  record("弹窗宽度为 600px", widthOk, `实际 ${Math.round(size.width)}px`);
  record("弹窗高度为页面 70%", heightOk, `实际 ${Math.round(size.height)}px / 70vh=${Math.round(size.vh70)}px`);

  // 5) 智能体嵌入初始化
  await waitFor(() => logs.some((l) => l.includes("初始化完成")), { timeout: 30000, label: "嵌入初始化日志" });
  record("createLocalAgent 嵌入初始化成功", true);

  // 6) 未加载状态：输入/发送禁用，状态显示未启动
  const inputDisabled = await page.locator("#panel-input").isDisabled();
  const sendDisabled = await page.locator("#panel-send").isDisabled();
  record("未加载模型时输入与发送禁用", inputDisabled && sendDisabled, `输入禁用=${inputDisabled} 发送禁用=${sendDisabled}`);

  // 7) 点击「启动本地智能体」→ 进度条出现（拦截模型请求验证 onError 分支，避免真实下载）
  await page.route(/\/hf\//, (route) => route.fulfill({ status: 500, contentType: "text/plain", body: "probe blocked (e2e)" }));
  await page.route(/\/gh-raw\//, (route) => route.fulfill({ status: 500, contentType: "text/plain", body: "probe blocked (e2e)" }));
  await page.route(/\/hf-transformers\//, (route) => route.fulfill({ status: 500, contentType: "text/plain", body: "probe blocked (e2e)" }));

  await page.click("#start-btn");
  await waitFor(() => page.locator("#progress-wrap").evaluate((el) => el.style.display !== "none"), {
    timeout: 10000,
    label: "进度条出现",
  });
  record("启动加载流程 UI 正常（进度条出现）", true);

  try {
    await waitFor(async () => ((await page.locator("#panel-status").textContent()) ?? "").includes("启动失败"), {
      timeout: 30000,
      interval: 500,
      label: "启动失败提示",
    });
  } catch (err) {
    const current = await page.locator("#panel-status").textContent();
    console.log("[probe] 等待'启动失败'超时，当前 statusText =", JSON.stringify(current));
    throw err;
  }
  const retryText = (await page.locator("#start-btn").textContent())?.trim();
  record("加载失败时错误提示与重试按钮正常（onError 分支）", retryText.includes("重试"), `按钮: ${retryText}`);

  // 8) 弹窗可关闭，悬浮球恢复
  await page.click("#panel-close");
  const panelClosed = await page.locator("#agent-panel").evaluate((el) => !el.classList.contains("open"));
  const fabBack = await page.locator("#agent-fab").isVisible();
  record("关闭弹窗后悬浮球恢复", panelClosed && fabBack, `弹窗关闭=${panelClosed} 悬浮球可见=${fabBack}`);

  // 9) 页面实时内容读取（read_page_content 底层：getPageSnapshot）
  const pageRead = await page.evaluate(async () => {
    const m = await import("/src/pageReader.js");
    // 9.1 全页快照（走 MutationObserver 缓存）
    const snap = m.getPageSnapshot({});
    // 9.2 selector 精确读取（选择内容较多的 .main 区域）
    const sel = m.getPageSnapshot({ selector: ".main" });
    // 9.3 智能体自身 UI 应被排除（data-local-agent-ui）
    const uiExcluded = !(snap.text ?? "").includes("已就绪") && !(snap.text ?? "").includes("思考过程");
    // 9.4 selector 未命中 → 自动回退整页并附 note
    const selMissing = m.getPageSnapshot({ selector: "#nope-nonexistent" });
    // 9.5 selector 命中但内容过少（.nav 仅导航链接）→ 自动回退整页并附 note
    const selTooShort = m.getPageSnapshot({ selector: ".nav" });
    // 9.6 实时性：插入标记元素，等 watcher 防抖刷新后快照应包含新内容
    const marker = document.createElement("div");
    marker.id = "e2e-marker";
    marker.textContent = "E2E实时标记内容REALTIME7Z9";
    document.body.appendChild(marker);
    await new Promise((r) => setTimeout(r, 1200)); // > debounce 600ms
    const snap2 = m.getPageSnapshot({});
    marker.remove();
    return {
      snapOk: snap.ok,
      snapHasTitle: (snap.title ?? "").includes("本地智能搜索"),
      snapHasContent: (snap.text ?? "").includes("本地智能"),
      uiExcluded,
      selOk: sel.ok && (sel.text ?? "").includes("本地智能"),
      selMissingOk: selMissing.ok && (selMissing.note ?? "").includes("未找到") && (selMissing.text ?? "").includes("本地智能"),
      selTooShortOk: selTooShort.ok && (selTooShort.note ?? "").includes("内容过少"),
      realtime: (snap2.text ?? "").includes("E2E实时标记内容REALTIME7Z9"),
    };
  });
  record("读取全页快照（标题+正文）", pageRead.snapOk && pageRead.snapHasTitle && pageRead.snapHasContent, JSON.stringify(pageRead));
  record("智能体自身 UI（弹窗/思考过程）从快照中排除", pageRead.uiExcluded);
  record("selector 模式读取指定区域（.main）", pageRead.selOk);
  record("selector 未命中自动回退整页并说明", pageRead.selMissingOk);
  record("selector 内容过少自动回退整页并说明", pageRead.selTooShortOk);
  record("MutationObserver 实时性（DOM 变化后快照更新）", pageRead.realtime);

  // 10) 控制台零错误（排除测试故意注入的 500 拦截错误与对应 onError 日志）
  const expectedTestErrors = ["probe blocked", "ProxyVerificationError", "model-config probe failed", "Failed to load resource", "加载失败", "启动失败"];
  const realErrors = errors.filter(
    (e) => !e.includes("favicon") && !expectedTestErrors.some((k) => e.includes(k)),
  );
  if (realErrors.length) {
    console.log("[probe] 控制台错误详情:");
    realErrors.forEach((e) => console.log("   -", e));
  }
  record("控制台无错误", realErrors.length === 0, realErrors.length ? realErrors.join(" | ").slice(0, 300) : "");
} catch (err) {
  record("测试完成", false, `异常: ${err.message}`);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n========== 智能搜索页验证: ${results.length - failed.length}/${results.length} 通过 ==========`);
process.exit(failed.length === 0 ? 0 : 1);
