/**
 * e2e-probe.mjs — Phase 1 快速探测
 * 验证：页面打开、加载按钮可见、控制台无报错、WebGPU 可用
 */
import { launchBrowser, collectConsole, waitFor } from "./e2e-helpers.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:5189";

const browser = await launchBrowser({ headless: true });
const page = await browser.newPage();
const { errors, warnings } = collectConsole(page);

try {
  console.log(`[probe] 打开页面: ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

  // 1) 加载按钮可见
  await waitFor(() => page.locator("#load-btn").isVisible(), { label: "加载按钮可见" });
  console.log("[probe] ✅ 加载按钮可见");

  // 2) 模型下拉有选项
  const optionCount = await page.locator("#model-select option").count();
  console.log(`[probe] ✅ 模型下拉选项数: ${optionCount}`);

  // 3) WebGPU 状态
  const webgpu = await page.evaluate(async () => {
    const probe = {
      gpuPresent: typeof navigator !== "undefined" && "gpu" in navigator,
      adapter: null,
      device: null,
      reason: null,
    };
    if (probe.gpuPresent) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          probe.adapter = JSON.stringify(adapter.info ?? {});
          try {
            const device = await adapter.requestDevice();
            probe.device = "ok";
            device.destroy();
          } catch (err) {
            probe.device = `requestDevice 失败: ${err?.message ?? err}`;
          }
        } else {
          probe.reason = "requestAdapter 返回 null";
        }
      } catch (err) {
        probe.reason = String(err?.message ?? err);
      }
    }
    return probe;
  });
  console.log("[probe] WebGPU:", JSON.stringify(webgpu, null, 2));
  if (!webgpu.gpuPresent || !webgpu.adapter) {
    console.log("[probe] ⚠️ WebGPU 不可用:", webgpu.reason);
  } else {
    console.log("[probe] ✅ WebGPU 可用，adapter:", webgpu.adapter);
  }

  // 4) 页面错误徽章
  const badgeText = await page.locator("#hardware-badge").textContent();
  console.log("[probe] 硬件徽章:", badgeText?.trim());

  // 5) 等待 app 初始化完成
  await page.waitForTimeout(3000);
} finally {
  const realErrors = errors.filter((e) => !e.includes("favicon"));
  console.log("\n[probe] ===== 控制台错误 =====");
  console.log(realErrors.length === 0 ? "无" : realErrors.join("\n"));
  console.log("[probe] ===== 控制台警告 =====");
  console.log(warnings.length === 0 ? "无" : warnings.join("\n").slice(0, 2000));
  await browser.close();
}

const hardErrors = errors.filter((e) => !e.includes("favicon"));
process.exit(hardErrors.length === 0 ? 0 : 1);
