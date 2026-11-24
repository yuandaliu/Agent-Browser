/**
 * eval-agent.mjs — 工具调用评测基线（REVIEW.md D4 / ROADMAP P4-A）
 *
 * 作用：把"agent 效果"变成**可回归的数字**。跑完输出每条用例的判定与
 * 成功率 / 平均步数 / 平均 TTFT，供版本间对比——采样参数、协议切换、解析器改动
 * 这类变更的收益与回退，靠它才能证明。
 *
 * 判定规则（与 eval-cases.mjs 的字段对应）：
 *   noTool: true            → 断言"一次工具都没调用"
 *   expectTools 有 1 个     → 断言该工具被调用
 *   expectTools 有多个      → 断言**全部**被调用（T05/T06 这类多步用例）
 *   answerIncludes/Excludes → 可选的答案子串断言
 *   工具维度与答案维度都通过，该条才算通过
 *
 * 用法（需先起 npm run proxy 与 npm run dev，且浏览器具备 WebGPU）：
 *   npm run test:eval
 *   npm run test:eval -- --limit=3              只跑前 3 条（调试用）
 *   npm run test:eval -- --json=eval-out.json   额外写出机器可读结果
 *   BASE_URL=http://127.0.0.1:5189 npm run test:eval
 *
 * 指标口径：
 *   TTFT      从点击发送到气泡出现首个非空文本的墙钟时间（轮询 200ms，精度到 0.2s）
 *   步数      该轮出现过的**不同工具名**个数（近似"步数"，用于观察多步能力）
 *   总耗时    从点击发送到气泡不再 streaming
 */
import fs from "node:fs";
import { launchBrowserSafe, collectConsole, waitFor } from "./e2e-helpers.mjs";
import { CASES, TOOL_NAMES } from "./eval-cases.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:5189";
const argOf = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
};
const LIMIT = Number(argOf("limit") ?? CASES.length);
const JSON_OUT = argOf("json");
const cases = CASES.slice(0, Number.isFinite(LIMIT) ? LIMIT : CASES.length);

/** 读取最近一条助手消息的工具调用轨迹（与 tests/e2e.mjs 同源做法） */
async function lastStepsText(page) {
  return page.evaluate(() => {
    const blocks = document.querySelectorAll(".msg-ai .steps-block .steps-body");
    const last = blocks[blocks.length - 1];
    return last ? last.textContent : "";
  });
}

async function runCase(page, c) {
  const t0 = Date.now();
  await page.fill("#input-box", c.prompt);
  await page.click("#send-btn");

  const before = await page.locator(".msg-ai").count();
  await waitFor(async () => (await page.locator(".msg-ai").count()) > before, {
    timeout: 30000,
    label: "出现助手消息",
  });

  const bubble = page.locator(".msg-ai .msg-bubble").last();

  let ttftMs = null;
  await waitFor(
    async () => {
      const txt = ((await bubble.textContent()) ?? "").trim();
      if (txt.length > 0 && txt !== "…") {
        if (ttftMs === null) ttftMs = Date.now() - t0;
        return true;
      }
      return false;
    },
    { timeout: 300000, interval: 200, label: "首个 token" },
  );

  await waitFor(
    async () => {
      const streaming = await bubble.evaluate((el) => el.classList.contains("streaming"));
      const txt = ((await bubble.textContent()) ?? "").trim();
      return !streaming && txt.length > 0 && txt !== "…";
    },
    { timeout: 300000, interval: 300, label: "回复完成" },
  );

  const answer = ((await bubble.textContent()) ?? "").trim();
  const steps = await lastStepsText(page);
  const usedTools = TOOL_NAMES.filter((n) => steps.includes(n));
  const totalMs = Date.now() - t0;

  const toolOk = c.noTool
    ? usedTools.length === 0
    : c.expectTools.length > 0 && c.expectTools.every((t) => usedTools.includes(t));
  const answerOk =
    (!c.answerIncludes || answer.includes(c.answerIncludes)) &&
    (!c.answerExcludes || !answer.includes(c.answerExcludes));

  return {
    id: c.id,
    category: c.category,
    prompt: c.prompt,
    expectTools: c.expectTools,
    noTool: Boolean(c.noTool),
    usedTools,
    steps: usedTools.length,
    ttftMs,
    totalMs,
    toolOk,
    answerOk,
    ok: toolOk && answerOk,
    answer: answer.slice(0, 120),
  };
}

const pad = (s, n) => String(s ?? "").padEnd(n);
const padL = (s, n) => String(s ?? "").padStart(n);

// 浏览器启动必须放在 try 内部：受限环境（沙箱 / 无命名管道权限）下
// chromium.launch 会直接抛 `spawn EPERM`（Playwright 用 --remote-debugging-pipe），
// 放在 try 外会让脚本以未捕获异常崩溃，而不是给出可读诊断。
let browser = null;
let errors = [];
const rows = [];
try {
  browser = await launchBrowserSafe({ headless: true });
  const page = await browser.newPage();
  errors = collectConsole(page).errors;

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitFor(() => page.locator("#load-btn").isVisible(), { label: "加载按钮可见" });

  const alreadyReady = await page
    .locator("#model-ready")
    .isVisible()
    .catch(() => false);
  if (!alreadyReady) {
    console.log("[eval] 模型未加载，点击「加载模型」并等待（首次可能数分钟）…");
    await page.click("#load-btn");
    await waitFor(() => page.locator("#model-ready").isVisible(), {
      timeout: 30 * 60 * 1000,
      interval: 1500,
      label: "模型加载完成",
    });
  }
  console.log(`[eval] 模型就绪，开始跑 ${cases.length} 条用例\n`);

  console.log(
    `${pad("ID", 5)}${pad("类别", 10)}${pad("期望工具", 34)}${pad("实际工具", 28)}${padL("步", 3)}${padL("TTFT", 7)}${padL("总耗时", 8)}  判定`,
  );
  console.log("-".repeat(115));

  for (const c of cases) {
    await page.click("#new-chat-btn").catch(() => {});
    await new Promise((r) => setTimeout(r, 300));
    const r = await runCase(page, c);
    rows.push(r);
    const expectLabel = c.noTool ? "(不调用工具)" : c.expectTools.join(" + ");
    console.log(
      `${pad(r.id, 5)}${pad(r.category, 10)}${pad(expectLabel, 34)}${pad(r.usedTools.join(",") || "-", 28)}` +
        `${padL(r.steps, 3)}${padL(r.ttftMs ?? "-", 7)}${padL(r.totalMs, 8)}  ${r.ok ? "✅" : "❌"}${r.ok ? "" : ` (工具${r.toolOk ? "✓" : "✗"} 答案${r.answerOk ? "✓" : "✗"}: ${r.answer.slice(0, 40)})`}`,
    );
  }
} catch (err) {
  // 浏览器启动失败已由 launchBrowserSafe 统一处理（打印诊断并 exit 1）；
  // 这里只兜「浏览器起来之后」的异常：页面加载超时、用例执行出错等。
  console.error("[eval] 中断:", err?.message ?? err);
} finally {
  if (browser) await browser.close().catch(() => {});
}

// ---------------- 汇总 ----------------
const passed = rows.filter((r) => r.ok).length;
const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
const ttfts = rows.map((r) => r.ttftMs).filter((x) => typeof x === "number");
const summary = {
  total: rows.length,
  passed,
  passRate: rows.length ? Number((passed / rows.length).toFixed(3)) : 0,
  avgSteps: avg(rows.map((r) => r.steps)),
  avgTtftMs: avg(ttfts),
  avgTotalMs: avg(rows.map((r) => r.totalMs)),
  byCategory: {},
};

for (const r of rows) {
  const b = (summary.byCategory[r.category] ??= { total: 0, passed: 0 });
  b.total += 1;
  if (r.ok) b.passed += 1;
}

console.log("\n========== 评测汇总 ==========");
console.log(`用例数        ${summary.total}`);
console.log(`通过          ${passed}/${rows.length}（${(summary.passRate * 100).toFixed(1)}%）`);
console.log(`平均步数      ${summary.avgSteps}`);
console.log(`平均 TTFT     ${summary.avgTtftMs ?? "-"} ms`);
console.log(`平均总耗时    ${summary.avgTotalMs ?? "-"} ms`);
console.log("分项:");
for (const [cat, b] of Object.entries(summary.byCategory)) {
  console.log(`  ${pad(cat, 10)} ${b.passed}/${b.total}`);
}

const failed = rows.filter((r) => !r.ok);
if (failed.length) {
  console.log("\n失败明细:");
  for (const r of failed) {
    console.log(`  ❌ ${r.id} ${r.prompt.slice(0, 40)}`);
    console.log(`     期望工具 [${r.expectTools.join(",") || (r.noTool ? "不调用" : "-")}]，实际 [${r.usedTools.join(",") || "-"}]`);
    console.log(`     答案: ${r.answer.slice(0, 80)}`);
  }
}

const realErrors = errors.filter((e) => !e.includes("favicon"));
if (realErrors.length) {
  console.log(`\n控制台错误 ${realErrors.length} 条（前 3）:`);
  realErrors.slice(0, 3).forEach((e) => console.log(`  ${e.slice(0, 160)}`));
}

if (JSON_OUT) {
  fs.writeFileSync(JSON_OUT, JSON.stringify({ summary, rows }, null, 2), "utf8");
  console.log(`\n[eval] 机器可读结果已写入 ${JSON_OUT}`);
}

process.exit(failed.length === 0 && rows.length === cases.length ? 0 : 1);
