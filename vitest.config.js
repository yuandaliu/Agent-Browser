/**
 * vitest.config.js — 单元测试配置
 *
 * 与 vite.config.js（开发/构建配置）分离，用途是**隔离测试范围**（不带构建插件与多入口）。
 *
 * 更正一处此前的错误结论：独立配置**不能**绕开 esbuild 的进程 spawn ——
 * vitest 加载任何配置文件都会先经 vite 的 config bundler（内部用 esbuild），
 * 在沙盒 / 杀软实时防护等受限环境里仍会 `spawn EPERM`，测试直接启动失败。
 * 遇到这种情况用 `tools/verify/run-unit-shim.mjs` 执行纯逻辑单测（最小 vitest 垫片，
 * 不经 esbuild），待环境放开后再跑正式门禁。
 *
 * 测试范围：仅 tests/unit/**（与浏览器 / DOM 无关的纯逻辑单测）。
 * E2E 测试（tests/e2e*）由独立的 scripts 驱动，不在此处覆盖。
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.js"],
    // 覆盖率口径：**只统计产品代码**，且必须写在 test.coverage 下。
    // 踩坑记录（2026-11-24）：vitest 3 的覆盖率配置属于 `test.coverage`，写在顶层会被静默忽略——
    // 表现为"thresholds 从不生效、默认口径把 dist-embed/ 打包产物（约 4.5 万行）、public/sw.js、
    // tools/verify/ 一起算进分母"，把总量稀释到 6.82%（而 branch 仍有 79.5%）。
    coverage: {
      provider: "v8",
      include: ["src/**/*.js", "server/**/*.mjs"],
      exclude: ["tests/**", "**/*.config.js"],
      // 基线（2026-11-24，src+server 口径，389 条测试全绿）：
      //   Stmts 84.29% / Lines 84.29% / Branch 80.28% / Funcs 82.74%
      // 门槛按"实测 −3%"取整（floor），留出正常波动的余量；跌破即说明有新代码没带测试。
      thresholds: {
        lines: 81,
        statements: 81,
        functions: 79,
        branches: 77,
      },
    },
  },
});
