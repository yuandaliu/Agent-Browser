/**
 * devProxy.test.js — dev-proxy 路由映射回归测试
 * 重点覆盖 P0-1：非法百分号编码不能打崩进程
 */
import { describe, it, expect } from "vitest";
import { buildUpstreamUrl, buildUpstreamCandidates } from "../../server/dev-proxy.mjs";

describe("buildUpstreamCandidates — 路由映射", () => {
  it("非法百分号编码返回 [] 而非抛错（P0-1 回归）", () => {
    const reqUrl = new URL("http://localhost/hf/%zz");
    expect(() => buildUpstreamCandidates(reqUrl)).not.toThrow();
    expect(buildUpstreamCandidates(reqUrl)).toEqual([]);
  });

  it("/hf/{owner}/{repo}/... 映射到多个 hf 镜像（默认 hf-mirror.com 优先）", () => {
    const reqUrl = new URL("http://localhost/hf/Qwen/Qwen3-5/config.json");
    const candidates = buildUpstreamCandidates(reqUrl);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    // 第一候选必须是 hf-mirror.com（保持向后兼容）
    expect(candidates[0].href).toBe("https://hf-mirror.com/Qwen/Qwen3-5/config.json");
    // 至少存在一个非 hf-mirror.com 的 fallback 候选
    expect(candidates.some((u) => u.host !== "hf-mirror.com")).toBe(true);
  });

  it("/hf-transformers 同样映射到多个 hf 镜像", () => {
    const reqUrl = new URL("http://localhost/hf-transformers/owner/repo/model.onnx");
    const candidates = buildUpstreamCandidates(reqUrl);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates[0].href).toBe("https://hf-mirror.com/owner/repo/model.onnx");
    expect(candidates.some((u) => u.host !== "hf-mirror.com")).toBe(true);
  });

  it("/gh-raw/{owner}/{repo}/{branch}/{rest} 返回 jsdelivr + jsdmirror + ghproxy 多上游 fallback", () => {
    const reqUrl = new URL("http://localhost/gh-raw/mlc-ai/binary-mlc-llm-libs/main/wasm/model.wasm");
    const candidates = buildUpstreamCandidates(reqUrl);
    expect(candidates.length).toBeGreaterThanOrEqual(3);
    // 第一个候选必须是 jsdelivr（保持向后兼容）
    expect(candidates[0].host).toBe("cdn.jsdelivr.net");
    expect(candidates[0].href).toBe(
      "https://cdn.jsdelivr.net/gh/mlc-ai/binary-mlc-llm-libs@main/wasm/model.wasm",
    );
    // 至少存在两个非 jsdelivr 候选（jsdmirror + ghproxy）
    expect(candidates.filter((u) => u.host !== "cdn.jsdelivr.net").length).toBeGreaterThanOrEqual(2);
  });

  it("/gh-raw 缺少 branch 段返回 []", () => {
    const reqUrl = new URL("http://localhost/gh-raw/owner/repo");
    expect(buildUpstreamCandidates(reqUrl)).toEqual([]);
  });

  it("无路由的路径返回 []", () => {
    const reqUrl = new URL("http://localhost/unknown/path");
    expect(buildUpstreamCandidates(reqUrl)).toEqual([]);
  });

  it("保留 query string", () => {
    const reqUrl = new URL("http://localhost/hf/owner/repo/file?revision=main");
    const candidates = buildUpstreamCandidates(reqUrl);
    expect(candidates[0].search).toBe("?revision=main");
  });
});

describe("buildUpstreamUrl — 向后兼容（返回第一候选）", () => {
  it("/gh-raw 返回第一候选 = jsdelivr", () => {
    const reqUrl = new URL("http://localhost/gh-raw/owner/repo/main/file.wasm");
    const upstream = buildUpstreamUrl(reqUrl);
    expect(upstream.href).toBe("https://cdn.jsdelivr.net/gh/owner/repo@main/file.wasm");
  });

  it("/hf 缺失路由时返回 null", () => {
    // 即使 buildUpstreamUrl 兼容旧逻辑，非法 URL 也应安全返回 null
    const reqUrl = new URL("http://localhost/hf/%zz");
    expect(buildUpstreamUrl(reqUrl)).toBeNull();
  });
});
