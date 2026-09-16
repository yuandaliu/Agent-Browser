/**
 * dev-proxy.mjs — 本地模型下载代理服务器
 *
 * BrowserAI 的 "proxy" 模式会把模型下载地址重写为 {origin}/hf/*、/hf-transformers/*、
 * /gh-raw/*，本服务器把这些路径转发到国内可访问的镜像，解决 huggingface.co /
 * raw.githubusercontent.com 被墙的问题：
 *
 *   /hf/{owner}/{repo}/...            → 多个 hf 镜像依次回退（默认 hf-mirror.com → hf-api.cn）
 *   /hf-transformers/{owner}/{repo}/… → 多个 hf 镜像依次回退（同上）
 *   /gh-raw/{owner}/{repo}/{branch}/… → 多个 jsdelivr 镜像依次回退（默认 jsdelivr → jsdmirror → ghproxy）
 *   /__worker-health                  → 健康检查（BrowserAI verifyProxy 使用）
 *
 * 为什么多上游？单镜像在国内访问稳定性差：cdn.jsdelivr.net 一被 QoS 限速就 30s 握手失败，
 * hf-mirror.com 也偶发 5xx。多上游 fallback 让 dev-proxy 自动换镜像继续探测/下载，
 * 避免整次加载被一次上游抖动卡死。
 *
 * 用法：node server/dev-proxy.mjs [端口]   （默认 8787）
 * 页面开发时由 vite.config.js 把 /hf* /gh-raw* 等路径代理到本服务器，保持页面同源。
 *
 * 环境变量：
 *   PROXY_PORT       监听端口（默认 8787）
 *   PROXY_TOKEN      设置后所有请求必须带 X-Proxy-Token 头或 ?token= 参数
 *   GH_RAW_UPSTREAMS 自定义 gh-raw 上游列表（空格分隔），覆盖默认 [jsdelivr, jsdmirror, ghproxy]
 *   HF_UPSTREAMS     自定义 hf 上游列表（空格分隔），覆盖默认 [hf-mirror.com, hf-api.cn]
 */
import http from "node:http";
import https from "node:https";
import { pathToFileURL } from "node:url";

const PORT = Number(process.argv[2] ?? process.env.PROXY_PORT ?? 8787);
const WORKER_HEADER = "browserai-proxy/dev";
// 公网部署安全：设置 PROXY_TOKEN 环境变量后，所有请求需携带 X-Proxy-Token 头或 ?token= 参数。
// 未设置时（本地开发）放行所有来源，保持原有行为。
const PROXY_TOKEN = process.env.PROXY_TOKEN ?? "";

// ---------- gh-raw 多上游 fallback ----------
// 顺序尝试：cdn.jsdelivr.net → cdn.jsdmirror.com → mirror.ghproxy.com
// （jsdelivr 国内镜像，URL 格式完全兼容）。
// 可通过 GH_RAW_UPSTREAMS 环境变量（空格分隔）覆盖。
const DEFAULT_GH_RAW_UPSTREAMS = ["cdn.jsdelivr.net", "cdn.jsdmirror.com", "mirror.ghproxy.com"];
function getGhRawUpstreams() {
  const env = process.env.GH_RAW_UPSTREAMS;
  if (env) {
    const list = env.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (list.length > 0) return list;
  }
  return DEFAULT_GH_RAW_UPSTREAMS;
}

// ---------- hf / hf-transformers 多上游 fallback ----------
// 顺序尝试：hf-mirror.com → hf-api.cn。
// 之前的单上游 hf-mirror.com 国内访问偶发超时/限速，会让整次下载失败。
// 加 hf-api.cn（huggingface 镜像）作为 fallback，单镜像挂掉时自动切下一个。
// 可通过 HF_UPSTREAMS 环境变量（空格分隔）覆盖。
const DEFAULT_HF_UPSTREAMS = ["hf-mirror.com", "hf-api.cn"];
function getHfUpstreams() {
  const env = process.env.HF_UPSTREAMS;
  if (env) {
    const list = env.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (list.length > 0) return list;
  }
  return DEFAULT_HF_UPSTREAMS;
}

function checkAccess(req, reqUrl) {
  if (!PROXY_TOKEN) return true; // 开发模式：未配置 token 即放行
  const headerToken = req.headers["x-proxy-token"] ?? "";
  const queryToken = reqUrl.searchParams.get("token") ?? "";
  return headerToken === PROXY_TOKEN || queryToken === PROXY_TOKEN;
}

// ---------- 路径 → 上游 URL 的映射规则 ----------

/**
 * 返回一组有序的上游候选 URL（按 fallback 顺序）。
 * 空数组表示该路径没有匹配的路由（调用方应回 404）。
 *
 * - /hf、/hf-transformers：多上游 fallback（见 getHfUpstreams()），默认 hf-mirror.com → hf-api.cn
 * - /gh-raw：多上游 fallback（见 getGhRawUpstreams()），默认 jsdelivr → jsdmirror → ghproxy
 */
export function buildUpstreamCandidates(reqUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(reqUrl.pathname);
  } catch {
    // 非法百分号编码 → 当作无路由返回 []，而不是抛 URIError 崩进程
    return [];
  }
  const parts = pathname.split("/").filter(Boolean);
  const [kind, ...rest] = parts;

  if (kind === "hf" || kind === "hf-transformers") {
    // /hf/{owner}/{repo}/... → 多个 huggingface 镜像依次回退（默认 hf-mirror.com → hf-api.cn）
    const pathTail = `${rest.map(encodeURIComponent).join("/")}${reqUrl.search}`;
    return getHfUpstreams().map((host) => new URL(`https://${host}/${pathTail}`));
  }
  if (kind === "gh-raw") {
    // /gh-raw/{owner}/{repo}/{branch}/{rest} → 多个 jsdelivr 镜像依次回退
    if (rest.length < 3) return [];
    const [owner, repo, branch, ...fileParts] = rest;
    const tail = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}@${encodeURIComponent(branch)}/${fileParts
      .map(encodeURIComponent)
      .join("/")}${reqUrl.search}`;
    return getGhRawUpstreams().map((host) => new URL(`https://${host}/gh/${tail}`));
  }
  return [];
}

/**
 * 向后兼容：返回第一候选上游 URL（等价于 buildUpstreamCandidates()[0] ?? null）。
 * 旧调用方（单元测试、外部脚本）继续可用；新逻辑请用 buildUpstreamCandidates。
 */
export function buildUpstreamUrl(reqUrl) {
  const list = buildUpstreamCandidates(reqUrl);
  return list[0] ?? null;
}

// ---------- 上游请求 ----------

/** 单次 HTTP 请求；timeoutMs 内未完成握手/响应即销毁。 */
function requestOnce(upstream, method, headers, timeoutMs) {
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
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`upstream timeout: ${upstream.host}`));
    });
    req.on("error", (err) => reject(err));
    req.end();
  });
}

/**
 * 单上游请求：仅对网络错误（ECONNRESET / ETIMEDOUT / ENOTFOUND / socket hang up 等）
 * 有限重试；HTTP 5xx 不在此层重试，由上层 requestUpstreamFallback 切下一个上游。
 *
 * 超时从原本的 30s 降到 12s：cdn.jsdelivr.net 一旦被 QoS 限速 30s 内根本连不上，
 * 等满 30s 是浪费；宁可早切下一个上游。
 */
const PER_UPSTREAM_TIMEOUT_MS = 12_000;
const PER_UPSTREAM_RETRIES = 1; // 网络错误重试次数（不含首次）

async function requestUpstreamWithRetry(upstream, method, headers) {
  let lastErr;
  for (let attempt = 0; attempt <= PER_UPSTREAM_RETRIES; attempt++) {
    try {
      return await requestOnce(upstream, method, headers, PER_UPSTREAM_TIMEOUT_MS);
    } catch (err) {
      lastErr = err;
      if (attempt < PER_UPSTREAM_RETRIES) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }
  throw lastErr;
}

/**
 * 多上游 fallback：依次尝试候选上游。
 * - 网络错误 / 5xx：切下一个上游
 * - 2xx / 3xx / 4xx：返回该响应（4xx 是客户端问题，不再切上游）
 * 返回 { response, upstream, errors }，全失败时 errors 数组非空，抛出合并后的 Error。
 */
async function requestUpstreamFallback(upstreams, method, headers) {
  const errors = [];
  for (const upstream of upstreams) {
    let res;
    try {
      res = await requestUpstreamWithRetry(upstream, method, headers);
    } catch (err) {
      console.error(`[dev-proxy] ${method} ${upstream.host} network error:`, err.message);
      errors.push(`${upstream.host}: ${err.message}`);
      continue;
    }
    const status = res.statusCode ?? 0;
    if (status >= 200 && status < 500) {
      // 4xx 也是客户端/上游资源问题（如 huggingface repo 不存在、文件 404），
      // 不切上游；释放 socket 避免连接泄漏（之前漏掉 resume，长时间高并发会泄漏 FD）。
      res.resume();
      return { response: res, upstream, errors };
    }
    // 5xx：读取并丢弃 body 以释放连接，再切下一个上游
    let bodySnippet = "";
    try {
      const chunks = [];
      for await (const chunk of res) chunks.push(chunk);
      bodySnippet = Buffer.concat(chunks).toString("utf8").slice(0, 200);
    } catch {
      /* 释放失败不影响下一步 */
    }
    console.error(`[dev-proxy] ${method} ${upstream.host} -> HTTP ${status}${bodySnippet ? `: ${bodySnippet}` : ""}`);
    errors.push(`${upstream.host}: HTTP ${status}`);
  }
  const err = new Error(`all upstreams failed: ${errors.join(" | ")}`);
  err.upstreamErrors = errors;
  throw err;
}

// 仅供单测：暴露多上游调度相关函数。
// 模块顶层仍有 if (isMainModule) server.listen() 守护，单测 import 不会启动 server。
export { requestUpstreamWithRetry, requestUpstreamFallback };

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

  const upstreamCandidates = buildUpstreamCandidates(reqUrl);
  if (upstreamCandidates.length === 0) {
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

    const { response: upstreamRes, upstream } = await requestUpstreamFallback(upstreamCandidates, req.method, headers);

    // 跟随重定向（仅一次，cdn.jsdelivr.net 等常会把 /main 重定向到具体 commit）
    if (
      upstreamRes.statusCode === 301 ||
      upstreamRes.statusCode === 302 ||
      upstreamRes.statusCode === 307 ||
      upstreamRes.statusCode === 308
    ) {
      const location = upstreamRes.headers.location;
      if (location) {
        upstreamRes.resume();
        const redirected = new URL(location, upstream);
        const retry = await requestUpstreamWithRetry(redirected, req.method, headers);
        forwardHeaders(retry, res, { "X-Proxy-Upstream": upstream.host });
        res.writeHead(retry.statusCode ?? 200);
        retry.pipe(res);
        return;
      }
    }

    forwardHeaders(upstreamRes, res, { "X-Proxy-Upstream": upstream.host });

    // 失败响应强制 no-store：避免 Service Worker 把 502/404 等错误缓存住，
    // 导致后续重试永远拿到同一个错误响应（曾经踩过的坑）。
    if ((upstreamRes.statusCode ?? 0) >= 400) {
      res.setHeader("Cache-Control", "no-store");
    }

    res.writeHead(upstreamRes.statusCode ?? 200);
    upstreamRes.pipe(res);
  } catch (err) {
    console.error(`[dev-proxy] ${req.method} ${reqUrl.pathname} FAILED:`, err.message);
    if (!res.headersSent) {
      res.setHeader("X-Proxy-Worker", WORKER_HEADER);
      res.setHeader("Cache-Control", "no-store");
      res.writeHead(502, { "Content-Type": "text/plain" });
    }
    res.end(`dev-proxy upstream error: ${err.message}`);
  }
});

// 仅作为主模块直接运行时启动服务器（import 时跳过，便于单测）
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  server.listen(PORT, () => {
    const upstreams = getGhRawUpstreams();
    console.log(`[dev-proxy] listening on http://localhost:${PORT}`);
    const hfUpstreams = getHfUpstreams();
    console.log(`[dev-proxy] /hf/*          -> ${hfUpstreams.map((h) => `https://${h}/*`).join(" → ")}`);
    console.log(`[dev-proxy] /gh-raw/*      -> ${upstreams.map((h) => `https://${h}/gh/*`).join(" → ")}`);
    if (upstreams.length > 1) console.log(`[dev-proxy] (gh-raw 按上述顺序自动 fallback，可通过 GH_RAW_UPSTREAMS 环境变量覆盖)`);
    if (hfUpstreams.length > 1) console.log(`[dev-proxy] (hf 按上述顺序自动 fallback，可通过 HF_UPSTREAMS 环境变量覆盖)`);
  });
}
