/**
 * e2e-helpers.mjs — E2E 测试公共工具
 */
import { chromium } from "playwright-core";
import fs from "node:fs";

/** 查找系统 Chrome（优先 Chrome，其次 Edge） */
export function findChrome() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("未找到 Chrome / Edge");
}

export async function launchBrowser({ headless = true, extraArgs = [] } = {}) {
  return chromium.launch({
    executablePath: findChrome(),
    headless,
    args: [
      "--enable-unsafe-webgpu", // headless 下启用 WebGPU
      "--enable-features=Vulkan",
      "--disable-features=CalculateNativeWinOcclusion",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-popup-blocking",
      "--window-size=1440,900",
      ...extraArgs,
    ],
  });
}

/**
 * launchBrowser 的安全包装：启动失败时给出可读诊断并以退出码 1 结束。
 *
 * 为什么需要它：所有 E2E 脚本都是「先 launch，再进 try」的结构，而
 * Playwright 通过 `--remote-debugging-pipe` 与浏览器通信（需要命名管道权限）。
 * 在受限环境（沙箱、无命名管道权限的 CI）下，launch 本身就会抛
 * `browserType.launch: spawn EPERM`——这句在 try 之外，会让脚本以**未捕获异常崩溃**，
 * 只留下一大段 Playwright 内部 call log，看不出真正原因。
 *
 * 用法：把 `launchBrowser(...)` 换成 `await launchBrowserSafe(...)` 即可。
 */
export async function launchBrowserSafe(opts) {
  try {
    return await launchBrowser(opts);
  } catch (err) {
    const msg = err?.message ?? String(err);
    console.error(`[e2e] 浏览器启动失败: ${msg}`);
    if (/spawn EPERM|remote-debugging-pipe|create signal pipe/i.test(msg)) {
      console.error("[e2e] 提示：Playwright 需要命名管道来驱动浏览器，受限环境（沙箱 / 受限 CI）下无法建立。");
      console.error("[e2e]       请在常规终端里执行本脚本；本机 Chrome / Edge 需已安装。");
    }
    process.exit(1);
  }
}

/** 收集页面控制台错误、警告与日志 */
export function collectConsole(page) {
  const errors = [];
  const warnings = [];
  const logs = [];
  page.on("console", (msg) => {
    const text = msg.text();
    const loc = (() => {
      try {
        const l = msg.location();
        return l?.url ? ` @${l.url}` : "";
      } catch {
        return "";
      }
    })();
    if (msg.type() === "error") errors.push(`${text}${loc}`);
    else if (msg.type() === "warning") warnings.push(`${text}${loc}`);
    else logs.push(text);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return { errors, warnings, logs };
}

export async function waitFor(fn, { timeout = 60000, interval = 500, label = "condition" } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await fn()) return true;
    } catch {
      /* 继续等待 */
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`等待超时（${timeout}ms）: ${label}`);
}
