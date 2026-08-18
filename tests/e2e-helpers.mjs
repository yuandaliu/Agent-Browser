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
