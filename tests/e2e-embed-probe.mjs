/**
 * e2e-embed-probe.mjs — 嵌入 demo 验证
 * 验证：宿主页面渲染、聊天浮窗、createLocalAgent 初始化、模型下拉、控制台零报错
 * 用法：node tests/e2e-embed-probe.mjs <demo-url>
 */
import { launchBrowser, collectConsole, waitFor } from "./e2e-helpers.mjs";

const url = process.argv[2] ?? "http://127.0.0.1:5189/demo/embed-demo.html";
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

  // 1) 宿主页面渲染
  await waitFor(() => page.locator(".nav .logo").isVisible(), { label: "宿主导航可见" });
  record("宿主页面正常渲染（导航/卡片/页脚）", true);

  // 2) 聊天浮窗
  await waitFor(() => page.locator("#la-fab").isVisible(), { label: "浮窗按钮可见" });
  await page.click("#la-fab");
  await waitFor(() => page.locator("#la-panel").evaluate((el) => el.classList.contains("open")), { label: "面板展开" });
  record("聊天浮窗可展开", true);

  // 3) 智能体初始化
  await waitFor(
    () => logs.some((l) => l.includes("智能体已初始化") || l.includes("嵌入示例运行正常")),
    { timeout: 30000, label: "智能体初始化日志" },
  );
  record("createLocalAgent 初始化成功", true);

  // 4) 模型下拉
  const optionCount = await page.locator("#la-model option").count();
  record("模型下拉有 5 个选项", optionCount === 5, `共 ${optionCount} 项`);

  // 5) 状态文本
  const status = (await page.locator("#la-status").textContent())?.trim();
  record("面板状态文本正常", status.length > 0, `当前: ${status}`);

  // 6) 控制台错误
  const realErrors = errors.filter((e) => !e.includes("favicon"));
  if (realErrors.length) {
    console.log("[probe] 控制台错误详情:");
    for (const e of realErrors) console.log("   -", e);
  }
  record("控制台无错误", realErrors.length === 0, realErrors.length ? realErrors.join(" | ").slice(0, 300) : "");
} catch (err) {
  record("测试完成", false, `异常: ${err.message}`);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n========== 嵌入验证: ${results.length - failed.length}/${results.length} 通过 ==========`);
process.exit(failed.length === 0 ? 0 : 1);
