/**
 * run-unit-shim.mjs — 用最小 vitest 垫片执行 tests/unit 下的纯逻辑测试文件
 *
 * 为什么存在：受限环境（沙盒 / 杀软实时防护）里 vitest 起不来——vite 加载配置时
 * 需要 esbuild spawn 子进程，会 `spawn EPERM`。本脚本用 Node 的 module hook 把
 * `import "vitest"` 重定向到 mini-vitest.mjs，从而在**不经过 esbuild** 的情况下
 * 真正执行测试文件里的断言（不是"看一眼代码"，是逐条跑）。
 *
 * 用法（需 Node ≥ 20.6，因为用到 module.register 与 --import）：
 *   node --import ./tools/verify/shim-register.mjs tools/verify/run-unit-shim.mjs
 *
 * 退场条件：环境恢复（能正常跑 `npm test`）后**删除本目录**——它只是受限环境的临时通道，
 * 不是第二套测试运行时，也不参与 CI 门禁。
 *
 * 支持范围：describe / it / beforeEach / afterEach / vi.fn / 常用匹配器
 * （含单测用到的 expect.stringContaining 与 toThrow(ErrorMessage)）。
 * 不支持：vi.mock（模块级 mock 依赖 vitest 的 hoisting）、假定时器、快照、覆盖率。
 * 因此下列文件仍需在能跑 vitest 的环境执行：
 *   embed.test.js（mock SDK / 记忆 / 页面读取 / 失败日志）、tools.handlers.test.js（mock pageReader）、
 *   devProxy.fallback.test.js（mock node:https）、main.helpers.test.js、modelLoader.createModelLoader.test.js、
 *   swSync.test.js、pageReader.bootstrap.test.js、memory.trim.test.js、evalCases.test.js。
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registry } from "./mini-vitest.mjs";

const FILES = [
  "agentLoop.test.js",
  "agentLoop.runAgent.test.js",
  "agentLoop.protocol.test.js",
  "contextBudget.test.js",
  "devProxy.test.js",
  "failureLog.test.js",
  "memory.test.js",
  "modelLoader.test.js",
  "pageReader.test.js",
  "swStrategies.test.js",
  "tools.test.js",
  "toolSchemas.test.js",
  "chatWidget.test.js",
];

// 以脚本自身位置推导仓库根：允许从任意 cwd 运行
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const UNIT_DIR = path.join(REPO_ROOT, "tests/unit");

let pass = 0;
let fail = 0;
const failures = [];
let currentFile = "";

function resetRegistry() {
  registry.suites.length = 0;
  registry.tests.length = 0;
  registry.beforeEach.length = 0;
  registry.afterEach.length = 0;
}

async function runSuite(suite, inherited = { beforeEach: [], afterEach: [] }) {
  const before = [...inherited.beforeEach, ...(suite.beforeEach ?? [])];
  const after = [...(suite.afterEach ?? []), ...inherited.afterEach];

  for (const hook of suite.beforeAll ?? []) await hook();

  for (const t of suite.tests) {
    const label = `${currentFile} › ${suite.name} › ${t.name}`;
    try {
      for (const hook of before) await hook();
      await t.fn();
      pass++;
      console.log(`  ✓ ${label}`);
    } catch (err) {
      fail++;
      failures.push({ label, message: err?.message ?? String(err) });
      console.log(`  ✗ ${label}\n      ${err?.message ?? err}`);
    } finally {
      for (const hook of after) {
        try {
          await hook();
        } catch {
          /* afterEach 失败不覆盖用例结果 */
        }
      }
    }
  }

  for (const child of suite.suites) {
    await runSuite(child, { beforeEach: before, afterEach: after });
  }

  for (const hook of suite.afterAll ?? []) await hook();
}

for (const file of FILES) {
  currentFile = file;
  resetRegistry();
  console.log(`\n[${file}]`);
  try {
    await import(pathToFileURL(path.join(UNIT_DIR, file)).href);
  } catch (err) {
    fail++;
    failures.push({ label: `${file}（加载失败）`, message: err?.stack ?? String(err) });
    console.log(`  ✗ 加载失败：${err?.message ?? err}`);
    continue;
  }
  await runSuite(registry);
}

console.log("\n========================================");
console.log(`通过 ${pass} 项，失败 ${fail} 项（文件 ${FILES.length} 个）`);
if (failures.length > 0) {
  console.log("\n失败明细：");
  for (const f of failures) console.log(`- ${f.label}\n  ${f.message}`);
  process.exit(1);
}
console.log("全部通过 ✅（注意：这是垫片执行结果，仍需在标准环境跑一次 `npm test`）");
