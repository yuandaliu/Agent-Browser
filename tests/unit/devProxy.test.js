/**
 * devProxy.test.js — dev-proxy 路由映射回归测试
 * 重点覆盖 P0-1：非法百分号编码不能打崩进程
 */
import { describe, it, expect } from "vitest";
import { buildUpstreamUrl } from "../../server/dev-proxy.mjs";

describe("buildUpstreamUrl — 路由映射", () => {
  it("非法百分号编码返回 null 而非抛错（P0-1 回归）", () => {
    const reqUrl = new URL("http://localhost/hf/%zz");
    expect(() => buildUpstreamUrl(reqUrl)).not.toThrow();
    expect(buildUpstreamUrl(reqUrl)).toBeNull();
  });

  it("/hf/{owner}/{repo}/... 映射到 hf-mirror.com", () => {
    const reqUrl = new URL("http://localhost/hf/Qwen/Qwen3-5/config.json");
    const upstream = buildUpstreamUrl(reqUrl);
    expect(upstream).not.toBeNull();
    expect(upstream.href).toBe("https://hf-mirror.com/Qwen/Qwen3-5/config.json");
  });

  it("/hf-transformers 同样映射到 hf-mirror.com", () => {
    const reqUrl = new URL("http://localhost/hf-transformers/owner/repo/model.onnx");
    const upstream = buildUpstreamUrl(reqUrl);
    expect(upstream.href).toBe("https://hf-mirror.com/owner/repo/model.onnx");
  });

  it("/gh-raw/{owner}/{repo}/{branch}/{rest} 映射到 jsdelivr", () => {
    const reqUrl = new URL("http://localhost/gh-raw/mlc-ai/binary-mlc-llm-libs/main/wasm/model.wasm");
    const upstream = buildUpstreamUrl(reqUrl);
    expect(upstream.href).toBe(
      "https://cdn.jsdelivr.net/gh/mlc-ai/binary-mlc-llm-libs@main/wasm/model.wasm",
    );
  });

  it("/gh-raw 缺少 branch 段返回 null", () => {
    const reqUrl = new URL("http://localhost/gh-raw/owner/repo");
    expect(buildUpstreamUrl(reqUrl)).toBeNull();
  });

  it("无路由的路径返回 null", () => {
    const reqUrl = new URL("http://localhost/unknown/path");
    expect(buildUpstreamUrl(reqUrl)).toBeNull();
  });

  it("保留 query string", () => {
    const reqUrl = new URL("http://localhost/hf/owner/repo/file?revision=main");
    const upstream = buildUpstreamUrl(reqUrl);
    expect(upstream.search).toBe("?revision=main");
  });
});
