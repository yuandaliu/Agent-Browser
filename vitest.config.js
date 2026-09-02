/**
 * vitest.config.js — 单元测试配置
 *
 * 与 vite.config.js（开发/构建配置）分离。原因：vitest 默认会尝试加载 vite.config.js，
 * 而 vite 内部用 esbuild bundle 配置，esbuild 在受限的 Windows 环境（沙盒 / 杀毒软件
 * 实时防护）下 spawn 子进程会被 EPERM 拒绝，导致测试无法启动。独立的 vitest 配置绕开
 * 这一加载路径。
 *
 * 测试范围：仅 tests/unit/**（与浏览器 / DOM 无关的纯逻辑单测）。
 * E2E 测试（tests/e2e*）由独立的 scripts 驱动，不在此处覆盖。
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.js"],
    // 不生成覆盖率（CI 流程里再单独跑 coverage，避免每次本地测试都生成报告）
  },
});
