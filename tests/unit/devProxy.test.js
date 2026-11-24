/**
 * devProxy.test.js — dev-proxy 路由映射回归测试
 * 重点覆盖 P0-1：非法百分号编码不能打崩进程
 */
import { describe, it, expect } from "vitest";
import {
  buildUpstreamUrl,
  buildUpstreamCandidates,
  isSafePathSegment,
  isAllowedRedirect,
  getAllowedRedirectHosts,
  resolveCorsOrigin,
  verifyToken,
} from "../../server/dev-proxy.mjs";

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

describe("路径安全 — 防止借代理做路径逃逸（P1-20）", () => {
  it("isSafePathSegment 拒绝空段/点段/分隔符/百分号/超长", () => {
    for (const bad of ["", ".", "..", "a/b", "a\\b", "a%2f", "x".repeat(201)]) {
      expect(isSafePathSegment(bad), `应拒绝 ${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it("isSafePathSegment 放行正常仓库名与文件名", () => {
    for (const ok of [
      "Qwen3.5-2B-q4f16_1-MLC",
      "config.json",
      "model_0.safetensors",
      ".gitattributes",
      "binary-mlc-llm-libs",
    ]) {
      expect(isSafePathSegment(ok), `应放行 ${ok}`).toBe(true);
    }
  });

  it("编码后的 .. 逃逸被拒绝（%2F 变体）", () => {
    // 直接写 /hf/../../api 会被 URL 规范化掉，必须用编码形式绕过规范化才能测到校验层
    const reqUrl = new URL("http://localhost/hf/a%2F..%2F..%2Fapi");
    expect(buildUpstreamCandidates(reqUrl)).toEqual([]);
  });

  it("双重编码绕过被拒绝", () => {
    const reqUrl = new URL("http://localhost/hf/%252e%252e/x");
    expect(buildUpstreamCandidates(reqUrl)).toEqual([]);
  });

  it("超深路径被拒绝", () => {
    const deep = Array.from({ length: 20 }, (_, i) => `d${i}`).join("/");
    expect(buildUpstreamCandidates(new URL(`http://localhost/hf/${deep}`))).toEqual([]);
  });

  it("/gh-raw 的文件段同样受校验", () => {
    const reqUrl = new URL("http://localhost/gh-raw/owner/repo/main/a%2F..%2F..%2Fsecret");
    expect(buildUpstreamCandidates(reqUrl)).toEqual([]);
  });

  it("/hf 无后续段返回 []", () => {
    expect(buildUpstreamCandidates(new URL("http://localhost/hf/"))).toEqual([]);
  });
});

describe("重定向白名单 — 防 SSRF（P1-1）", () => {
  const allowed = getAllowedRedirectHosts();

  it("白名单来自当前配置的镜像", () => {
    expect(allowed.has("hf-mirror.com")).toBe(true);
    expect(allowed.has("cdn.jsdelivr.net")).toBe(true);
  });

  it("同 host / 镜像自有子域 / https → 允许", () => {
    expect(isAllowedRedirect(new URL("https://hf-mirror.com/api"), "hf-mirror.com")).toBe(true);
    expect(isAllowedRedirect(new URL("https://cdn.hf-mirror.com/x"), "hf-mirror.com")).toBe(true);
    expect(
      isAllowedRedirect(new URL("https://cdn.jsdelivr.net/gh/a/b@main/x"), "cdn.jsdelivr.net"),
    ).toBe(true);
  });

  it("云元数据 / 内网地址 / 明文 http / 非法输入 → 拒绝", () => {
    expect(
      isAllowedRedirect(new URL("http://169.254.169.254/latest/meta-data"), "hf-mirror.com"),
    ).toBe(false);
    expect(isAllowedRedirect(new URL("https://169.254.169.254/"), "hf-mirror.com")).toBe(false);
    expect(isAllowedRedirect(new URL("https://evil.example.com/x"), "hf-mirror.com")).toBe(false);
    expect(isAllowedRedirect(new URL("http://hf-mirror.com/x"), "hf-mirror.com")).toBe(false);
    expect(isAllowedRedirect(null, "hf-mirror.com")).toBe(false);
    expect(isAllowedRedirect("https://hf-mirror.com/x", "hf-mirror.com")).toBe(false);
  });
});

describe("resolveCorsOrigin — 默认只信任本地来源（P1-2）", () => {
  it("无 Origin → 不设置该头（同源 / curl 场景）", () => {
    expect(resolveCorsOrigin(undefined)).toBeNull();
    expect(resolveCorsOrigin("")).toBeNull();
  });

  it("本地 origin 回显（Vite dev 场景）", () => {
    expect(resolveCorsOrigin("http://127.0.0.1:5189")).toBe("http://127.0.0.1:5189");
    expect(resolveCorsOrigin("http://localhost:5189")).toBe("http://localhost:5189");
  });

  it("非法 origin 字符串 → null 而非抛错", () => {
    expect(resolveCorsOrigin("not-a-url")).toBeNull();
  });
});

describe("verifyToken — 恒定时间比较（P1-19）", () => {
  it("未配置期望令牌 → 放行（本地开发）", () => {
    expect(verifyToken("", "", "")).toBe(true);
    expect(verifyToken("任意值", undefined, "")).toBe(true);
  });

  it("正确令牌来自 header 或 query 均可通过", () => {
    expect(verifyToken("s3cret", "", "s3cret")).toBe(true);
    expect(verifyToken("", "s3cret", "s3cret")).toBe(true);
  });

  it("错误令牌 / 前缀相同 / 空 → 拒绝", () => {
    expect(verifyToken("wrong", "", "s3cret")).toBe(false);
    expect(verifyToken("s3cre", "", "s3cret")).toBe(false);
    expect(verifyToken("", "", "s3cret")).toBe(false);
  });
});
