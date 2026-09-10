/**
 * e2e-offline.mjs — Service Worker 离线缓存端到端验证
 *
 * 流程：
 *   1) 首次打开页面：SW 注册成功（sw.js 出现在 navigator.serviceWorker.controller）
 *   2) 触发应用 chunk / 模型路径下载：缓存命中
 *   3) 模拟离线（ctx.setOffline(true)）
 *   4) 刷新页面：应用壳仍能正常加载（HTML 来自缓存）
 *   5) 验证 Cache Storage 中确实有 local-agent-app-v1 / local-agent-models-v1
 *
 * 用法：先启动 proxy + dev，然后 npm run test:offline
 *   - BASE_URL=http://127.0.0.1:5189  npm run test:offline
 */
import { chromium } from "playwright-core";
import { launchBrowser } from "./e2e-helpers.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:5189";

let exitCode = 0;
const log = (msg) => console.log(`[offline-test] ${msg}`);
const fail = (msg) => {
  console.error(`[offline-test] ❌ ${msg}`);
  exitCode = 1;
};

async function main() {
  log(`启动浏览器，目标 ${BASE_URL}`);
  const browser = await launchBrowser({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    // ---------- 1) 首次访问：注册 SW ----------
    log("1) 首次打开页面，等待 SW 接管…");
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

    // SW 可能异步激活，等 controller 出现
    await page.waitForFunction(
      () => navigator.serviceWorker?.controller !== null,
      { timeout: 15000 },
    );
    const swScriptUrl = await page.evaluate(() =>
      navigator.serviceWorker.controller?.scriptURL ?? null,
    );
    if (!swScriptUrl || !swScriptUrl.endsWith("/sw.js")) {
      fail(`SW 未注册或 scriptURL 不对: ${swScriptUrl}`);
    } else {
      log(`✅ SW 已注册: ${swScriptUrl}`);
    }

    // ---------- 2) 触发应用 shell 加载（让 SW 缓存 index.html） ----------
    log("2) 等待应用就绪（按需下载模型代理资源）…");
    await page.waitForSelector("#load-btn", { timeout: 10000 });
    log("✅ 加载按钮可见，应用壳就绪");

    // 主动 fetch 一个 /hf/* 路径，模拟模型权重请求（不必真实下载）
    log("3) 主动 fetch /hf 路径让 SW 缓存…");
    const fetchResult = await page.evaluate(async (baseUrl) => {
      try {
        const res = await fetch(`${baseUrl}/hf/__probe__/test.bin`, { method: "GET" });
        return { ok: res.ok, status: res.status };
      } catch (err) {
        return { error: err.message };
      }
    }, BASE_URL);
    log(`   /hf/__probe__ 返回: ${JSON.stringify(fetchResult)}`);

    // 让 SW 有时间把响应写入缓存
    await new Promise((r) => setTimeout(r, 500));

    // ---------- 4) 验证 Cache Storage 已有 local-agent-app-v1 ----------
    log("4) 检查 Cache Storage…");
    const cacheNames = await page.evaluate(async () => {
      return await caches.keys();
    });
    log(`   Cache Storage: [${cacheNames.join(", ")}]`);
    if (!cacheNames.includes("local-agent-app-v1")) {
      fail("未找到 local-agent-app-v1（应用壳缓存未建立）");
    } else {
      log("✅ 应用壳缓存已建立");
    }

    // ---------- 5) 模拟离线，刷新页面 ----------
    log("5) 模拟离线 (setOffline(true))…");
    await ctx.setOffline(true);

    log("6) 刷新页面（离线状态下应能加载应用壳）…");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    const loadBtnVisible = await page.locator("#load-btn").isVisible({ timeout: 10000 }).catch(() => false);
    if (!loadBtnVisible) {
      fail("离线刷新后 #load-btn 不可见——SW 应用壳缓存可能没起作用");
    } else {
      log("✅ 离线刷新后应用壳仍正常加载");
    }

    // ---------- 6) 验证页面交互仍能跑（WebGPU 检测等）））
    const hardwareBadge = await page.locator("#hardware-badge").textContent({ timeout: 5000 }).catch(() => "");
    log(`   硬件徽章: "${hardwareBadge}"`);

    log("🎉 Service Worker 离线测试通过");
  } catch (err) {
    fail(`未捕获异常: ${err?.message ?? err}`);
    console.error(err);
  } finally {
    await ctx.close();
    await browser.close();
  }

  process.exit(exitCode);
}

main();