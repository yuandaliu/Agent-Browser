/**
 * swSync.test.js — public/sw.js 与 src/swStrategies.js 的一致性守卫
 *
 * 背景：SW 不支持 ESM import，public/sw.js 里 inline 复制了 swStrategies.js 的策略函数。
 * 此前 sw.js 把 isModelRequest/isAppChunkRequest 误写成 async，导致 if(Promise) 恒真、
 * 所有同源 GET 都走 cacheFirst，策略矩阵失效（swStrategies.test.js 只测 src 版本，测不到）。
 *
 * 本文件从源码层面守卫两件事：
 *   1. 签名：sw.js 的判定函数不得为 async（否则返回 Promise，if 恒真）
 *   2. 路径：sw.js 判断的路径前缀集合必须与 swStrategies.js 一致（防路径列表漂移）
 *
 * 注意：sw.js 整体逻辑仍无法被单测直接覆盖（SW 限制），改动 sw.js 后务必手动验证 SW 实际行为。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { isModelRequest, isAppChunkRequest } from "../../src/swStrategies.js";

describe("public/sw.js 与 src/swStrategies.js 一致性守卫", () => {
  const swSrc = readFileSync(resolve("public/sw.js"), "utf8");

  it("isModelRequest / isAppChunkRequest 不得为 async（否则 if(Promise) 恒真）", () => {
    expect(swSrc).not.toMatch(/async\s+function\s+(isModelRequest|isAppChunkRequest)\b/);
  });

  it("两文件判断的路径集合必须完全一致（真双源比对，防单侧漂移）", () => {
    // 从源码提取 pathname 判定用到的路径字面量（startsWith / endsWith / === 三种写法）
    const extractPaths = (src) => {
      const paths = new Set();
      const methodRe = /pathname\s*\.(?:startsWith|endsWith)\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
      const eqRe = /pathname\s*===\s*["'`]([^"'`]+)["'`]/g;
      for (const re of [methodRe, eqRe]) {
        let m;
        while ((m = re.exec(src))) paths.add(m[1]);
      }
      return [...paths].sort();
    };
    const strategiesSrc = readFileSync(resolve("src/swStrategies.js"), "utf8");
    // 关键：不从测试里硬编码期望值（那是第三份副本，只改一侧不会失败）——
    // 以 swStrategies.js 为单一数据源，与 sw.js 提取结果做双向相等断言，
    // 任一侧增删路径而另一侧未同步，本测试即失败。
    expect(extractPaths(swSrc)).toEqual(extractPaths(strategiesSrc));
  });

  it("swStrategies.js 的 isModelRequest / isAppChunkRequest 行为基线（防源头被改）", () => {
    expect(isModelRequest(new URL("http://x/hf/a/b"))).toBe(true);
    expect(isModelRequest(new URL("http://x/assets/x.js"))).toBe(false);
    expect(isAppChunkRequest(new URL("http://x/assets/x.js"))).toBe(true);
    expect(isAppChunkRequest(new URL("http://x/hf/a/b"))).toBe(false);
  });

  it("两文件均不得再缓存模型权重（REVIEW.md A1：cacheFirst 已整体移除）", () => {
    const strategiesSrc = readFileSync(resolve("src/swStrategies.js"), "utf8");
    // 定义与调用都不得残留：模型权重放行给浏览器，缓存唯一交给 SDK 的 IndexedDB
    expect(swSrc).not.toMatch(/cacheFirst/);
    expect(strategiesSrc).not.toMatch(/cacheFirst/);
  });

  it("模型缓存已移出 SW，且 VERSION 已递增到 v3+（否则历史死副本不会被回收）", () => {
    // v3 起 SW 不再写 local-agent-models-*，但旧版本留下的副本仍占用户磁盘（2B 档 ~1.2GB），
    // 必须靠 activate 的 "local-agent-" 前缀清理 + 版本递增才能收回来。
    expect(swSrc).not.toMatch(/MODEL_CACHE/);
    expect(swSrc).toMatch(/k\.startsWith\("local-agent-"\)/);
    const versionMatch = swSrc.match(/const VERSION\s*=\s*"v(\d+)"/);
    expect(versionMatch).not.toBeNull();
    expect(Number(versionMatch[1])).toBeGreaterThanOrEqual(3);
  });
});
