/**
 * dev-proxy.mjs — 本地模型下载代理服务器
 *
 * BrowserAI 的 "proxy" 模式会把模型下载地址重写为 {origin}/hf/*、/hf-transformers/*、
 * /gh-raw/*，本服务器把这些路径转发到国内可访问的镜像，解决 huggingface.co /
 * raw.githubusercontent.com 被墙的问题：
 *
 *   /hf/{owner}/{repo}/...            → https://hf-mirror.com/{owner}/{repo}/...
 *   /hf-transformers/{owner}/{repo}/… → https://hf-mirror.com/{owner}/{repo}/…
 *   /gh-raw/{owner}/{repo}/{branch}/… → https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/…
 *   /__worker-health                  → 健康检查（BrowserAI verifyProxy 使用）
 *
 * 用法：node server/dev-proxy.mjs [端口]   （默认 8787）
 * 页面开发时由 vite.config.js 把 /hf* /gh-raw* 等路径代理到本服务器，保持页面同源。
 */
import http from "node:http";
import https from "node:https";
import { pathToFileURL } from "node:url";

const PORT = Number(process.argv[2] ?? process.env.PROXY_PORT ?? 8787);
const WORKER_HEADER = "browserai-proxy/dev";
// 公网部署安全：设置 PROXY_TOKEN 环境变量后，所有请求需携带 X-Proxy-Token 头或 ?token= 参数。
// 未设置时（本地开发）放行所有来源，保持原有行为。
const PROXY_TOKEN = process.env.PROXY_TOKEN ?? "";

function checkAccess(req, reqUrl) {
  if (!PROXY_TOKEN) return true; // 开发模式：未配置 token 即放行
  const headerToken = req.headers["x-proxy-token"] ?? "";
  const queryToken = reqUrl.searchParams.get("token") ?? "";
  return headerToken === PROXY_TOKEN || queryToken === PROXY_TOKEN;
}

// ---------- 路径 → 上游 URL 的映射规则 ----------

export function buildUpstreamUrl(reqUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(reqUrl.pathname);
  } catch {
    // 非法百分号编码 → 当作无路由返回 404，而不是抛 URIError 崩进程
    return null;
  }
  const parts = pathname.split("/").filter(Boolean);
  const [kind, ...rest] = parts;

  if (kind === "hf") {
    // /hf/{owner}/{repo}/... → https://hf-mirror.com/{owner}/{repo}/...
    return new URL(`https://hf-mirror.com/${rest.map(encodeURIComponent).join("/")}${reqUrl.search}`);
  }
  if (kind === "hf-transformers") {
    // /hf-transformers/{owner}/{repo}/... → https://hf-mirror.com/{owner}/{repo}/...
    return new URL(`https://hf-mirror.com/${rest.map(encodeURIComponent).join("/")}${reqUrl.search}`);
  }
  if (kind === "gh-raw") {
    // /gh-raw/{owner}/{repo}/{branch}/{rest} → https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{rest}
    if (rest.length < 3) return null;
    const [owner, repo, branch, ...fileParts] = rest;
    return new URL(
      `https://cdn.jsdelivr.net/gh/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}@${encodeURIComponent(branch)}/${fileParts
        .map(encodeURIComponent)
        .join("/")}${reqUrl.search}`,
    );
  }
  return null;
}

// ---------- 上游请求（带重试，hf-mirror 偶发超时） ----------

function requestUpstream(upstream, method, headers, attemptsLeft = 3) {
  return new Promise((resolve, reject) => {
    const driver = upstream.protocol === "https:" ? https : http;
    const req = driver.request(
      upstream,
      {
        method,
        headers,
        // 让 Node 自动处理 gzip/deflate/br 解压（模型文件一般已压缩或直接二进制，不影响）
      },
      (res) => resolve(res),
    );
    req.setTimeout(30000, () => {
      req.destroy(new Error(`upstream timeout: ${upstream.host}`));
    });
    req.on("error", (err) => reject(err));
    req.end();
  }).catch(async (err) => {
    if (attemptsLeft > 1) {
      await new Promise((r) => setTimeout(r, 500));
      return requestUpstream(upstream, method, headers, attemptsLeft - 1);
    }
    throw err;
  });
}

// ---------- 转发响应 ----------

function forwardHeaders(src, res, extra = {}) {
  const copy = new Set([
    "content-type",
    "content-length",
    "accept-ranges",
    "content-range",
    "etag",
    "last-modified",
    "cache-control",
    "expires",
    "vary",
    "x-content-type-options",
  ]);
  for (const [key, value] of Object.entries(src.headers)) {
    if (copy.has(key) && value !== undefined) res.setHeader(key, value);
  }
  for (const [key, value] of Object.entries(extra)) res.setHeader(key, value);
  res.setHeader("X-Proxy-Worker", WORKER_HEADER);
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  // CORS（跨源场景：页面 origin 与代理 origin 不一致时）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "X-Proxy-Worker, Content-Range, Accept-Ranges, Content-Length, ETag");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // 健康检查：BrowserAI verifyProxy 依赖该端点 + X-Proxy-Worker 头
  if (reqUrl.pathname === "/__worker-health") {
    res.setHeader("X-Proxy-Worker", WORKER_HEADER);
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, version: WORKER_HEADER }));
    return;
  }

  // 公网部署访问控制：配置了 PROXY_TOKEN 时校验令牌，防止代理被当作开放镜像中转
  if (!checkAccess(req, reqUrl)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("dev-proxy: access denied (token required)");
    return;
  }

  const upstream = buildUpstreamUrl(reqUrl);
  if (!upstream) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("dev-proxy: no route for " + reqUrl.pathname);
    return;
  }

  try {
    const headers = {
      "user-agent": "Mozilla/5.0 (dev-proxy)",
      accept: req.headers.accept ?? "*/*",
      "accept-encoding": "identity", // 上游已处理编码，避免二次压缩
    };
    if (req.headers.range) headers.range = req.headers.range; // 分片下载支持
    if (req.headers["if-none-match"]) headers["if-none-match"] = req.headers["if-none-match"];

    const upstreamRes = await requestUpstream(upstream, req.method, headers);
    if (upstreamRes.statusCode === 301 || upstreamRes.statusCode === 302 || upstreamRes.statusCode === 307 || upstreamRes.statusCode === 308) {
      const location = upstreamRes.headers.location;
      if (location) {
        upstreamRes.resume();
        // jsdelivr 等 CDN 的重定向（如 /main → 具体版本），跟随一次
        const redirected = new URL(location, upstream);
        const retry = await requestUpstream(redirected, req.method, headers);
        forwardHeaders(retry, res, {});
        res.writeHead(retry.statusCode ?? 200);
        retry.pipe(res);
        return;
      }
    }

    forwardHeaders(upstreamRes, res, {});
    res.writeHead(upstreamRes.statusCode ?? 200);
    upstreamRes.pipe(res);
  } catch (err) {
    console.error(`[dev-proxy] ${req.method} ${reqUrl.pathname} -> ${upstream.href} FAILED:`, err.message);
    if (!res.headersSent) {
      res.setHeader("X-Proxy-Worker", WORKER_HEADER);
      res.writeHead(502, { "Content-Type": "text/plain" });
    }
    res.end(`dev-proxy upstream error: ${err.message}`);
  }
});

// 仅作为主模块直接运行时启动服务器（import 时跳过，便于单测）
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  server.listen(PORT, () => {
    console.log(`[dev-proxy] listening on http://localhost:${PORT}`);
    console.log(`[dev-proxy] /hf/*        -> https://hf-mirror.com/*`);
    console.log(`[dev-proxy] /gh-raw/*    -> https://cdn.jsdelivr.net/gh/*`);
  });
}
