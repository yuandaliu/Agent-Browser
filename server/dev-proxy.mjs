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
 *   PROXY_HOST       监听地址（默认 127.0.0.1，仅本机可访问；跨机器调试才设 0.0.0.0）
 *   PROXY_TOKEN      设置后所有请求必须带 X-Proxy-Token 头或 ?token= 参数（?token= 已废弃）
 *   PROXY_CORS_ORIGINS  CORS 白名单（逗号分隔；"*" 表示放开，需配合 PROXY_TOKEN）
 *   PROXY_ALLOW_REDIRECTS  设为 0 时拒绝一切 3xx 跟随（默认开启，但目标必须命中镜像白名单）
 *   GH_RAW_UPSTREAMS 自定义 gh-raw 上游列表（空格分隔），覆盖默认 [jsdelivr, jsdmirror, ghproxy]
 *   HF_UPSTREAMS     自定义 hf 上游列表（空格分隔），覆盖默认 [hf-mirror.com, hf-api.cn]
 */
import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import { pathToFileURL } from "node:url";

const PORT = Number(process.argv[2] ?? process.env.PROXY_PORT ?? 8787);
// 只监听回环地址：默认无鉴权时，代理绝不能暴露到局域网/公网。
// 需要跨机器调试时显式设 PROXY_HOST=0.0.0.0，并务必同时设置 PROXY_TOKEN。
const PROXY_HOST = process.env.PROXY_HOST ?? "127.0.0.1";
const WORKER_HEADER = "browserai-proxy/dev";
// 公网部署安全：设置 PROXY_TOKEN 环境变量后，所有请求需携带 X-Proxy-Token 头或 ?token= 参数。
// 未设置时（本地开发）放行所有来源——但此时服务只监听回环地址（见 PROXY_HOST）。
const PROXY_TOKEN = process.env.PROXY_TOKEN ?? "";
// CORS：默认只回显"本地 origin"（vite dev 是同源代理，不经过 CORS）。
// 跨源嵌入场景可显式放开：
//   PROXY_CORS_ORIGINS=*                 放开所有来源（请配合 PROXY_TOKEN 共用）
//   PROXY_CORS_ORIGINS=https://a,https://b   逗号分隔白名单
const PROXY_CORS_ORIGINS = (process.env.PROXY_CORS_ORIGINS ?? "").trim();
// 3xx 跟随开关：默认开启，但目标必须命中镜像白名单且为 https（见 isAllowedRedirect）。
// 设为 0 时直接拒绝重定向（返回 502），用于排查可疑跳转（**仅调试用**，正常开发保持默认即可）。
const PROXY_ALLOW_REDIRECTS = process.env.PROXY_ALLOW_REDIRECTS !== "0";

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
// 单上游（hf-mirror.com）在国内访问偶发超时/限速，会让整次下载失败。
// hf-api.cn（huggingface 镜像）作为 fallback，单镜像挂掉时自动切下一个。
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

/** 本地来源主机名（Vite dev / 本机部署，含 IPv6 回环） */
const LOCAL_ORIGIN_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function isLocalOrigin(origin) {
  if (!origin) return false;
  try {
    return LOCAL_ORIGIN_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** sha256 等长化：让 timingSafeEqual 不因长度差异抛错或泄露长度 */
function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest();
}

/**
 * 恒定时间比较访问令牌。
 * - 未配置 PROXY_TOKEN（本地开发）→ 直接放行
 * - 否则对 header 与 query 两种来源都比一遍，不短路，避免"命中即返回"的时序差异
 *
 * 导出供单测：expectedToken 可注入，避免测试依赖进程环境变量。
 */
export function verifyToken(headerToken, queryToken, expectedToken = PROXY_TOKEN) {
  if (!expectedToken) return true;
  const expected = sha256(expectedToken);
  const candidates = [headerToken, queryToken].filter(
    (t) => typeof t === "string" && t.length > 0,
  );
  let ok = false;
  for (const candidate of candidates) {
    if (crypto.timingSafeEqual(sha256(candidate), expected)) ok = true;
  }
  return ok;
}

let warnedQueryToken = false;

function checkAccess(req, reqUrl) {
  if (!PROXY_TOKEN) return true; // 开发模式：未配置 token 即放行（且只监听回环）
  const headerToken = req.headers["x-proxy-token"] ?? "";
  const queryToken = reqUrl.searchParams.get("token") ?? "";
  if (queryToken && !warnedQueryToken) {
    warnedQueryToken = true;
    console.warn(
      "[dev-proxy] 通过 ?token= 传递令牌已废弃：会进入浏览器历史/中间层日志，请改用 X-Proxy-Token 头",
    );
  }
  return verifyToken(headerToken, queryToken);
}

/**
 * 计算响应应回的 Access-Control-Allow-Origin。
 * 返回 null 表示"不设置该头"——跨源读取会被浏览器默认拒绝，这是默认安全姿态。
 *
 * 优先级：显式配置 > 已鉴权部署（回显来源）> 本地来源（回显）> 拒绝
 */
export function resolveCorsOrigin(requestOrigin) {
  if (PROXY_CORS_ORIGINS) {
    if (PROXY_CORS_ORIGINS === "*") return "*";
    const allow = PROXY_CORS_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return requestOrigin && allow.includes(requestOrigin) ? requestOrigin : null;
  }
  if (!requestOrigin) return null; // 同源请求 / curl：不需要该头
  if (PROXY_TOKEN) return requestOrigin; // 已鉴权：允许任意来源读取（令牌才是边界）
  return isLocalOrigin(requestOrigin) ? requestOrigin : null;
}

// ---------- 路径 → 上游 URL 的映射规则 ----------

const MAX_PATH_SEGMENTS = 12; // 镜像路径不会比这更深（HF LFS 最长约 6 段）
const MAX_PATH_SEGMENT_LENGTH = 200;

/**
 * 单段路径安全性校验。
 *
 * `encodeURIComponent` **不会**转义 "." 与 ".."，所以 `/hf/a%2f..%2f..%2fapi` 在
 * URL 规范化后会变成 `https://<mirror>/api` —— 借代理访问镜像站任意路径。
 * 因此必须在 decode 之后、encode 之前显式拒绝。
 */
export function isSafePathSegment(segment) {
  if (typeof segment !== "string") return false;
  if (segment.length === 0 || segment.length > MAX_PATH_SEGMENT_LENGTH) return false;
  if (segment === "." || segment === "..") return false;
  if (/[/\\]/.test(segment)) return false;
  if (segment.includes("%")) return false; // 双重编码残留（真实权重文件名不含 %）
  for (let i = 0; i < segment.length; i++) {
    const code = segment.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return false; // 控制字符
  }
  return true;
}

function isSafeSegmentList(segments) {
  if (segments.length > MAX_PATH_SEGMENTS) return false;
  return segments.every(isSafePathSegment);
}

/**
 * 允许重定向命中的镜像 host 集合（来自当前配置的上游列表）。
 * 只信任"我们自己配置的镜像"，而不是任意攻击者可控的 Location。
 */
export function getAllowedRedirectHosts() {
  return new Set([...getHfUpstreams(), ...getGhRawUpstreams()].map((h) => h.toLowerCase()));
}

/**
 * 重定向目标是否可信。
 * 要求：https + host 命中白名单（含镜像自有子域，如 cdn.hf-mirror.com）。
 * 未通过时调用方必须拒绝跟随（SSRF 防线）。
 */
export function isAllowedRedirect(target, upstreamHost, allowedHosts = getAllowedRedirectHosts()) {
  if (!target || !(target instanceof URL)) return false;
  if (target.protocol !== "https:") return false;
  const host = target.hostname.toLowerCase();
  if (!host) return false;
  const fromHost = String(upstreamHost ?? "")
    .replace(/:\d+$/, "")
    .toLowerCase();
  if (fromHost && host === fromHost) return true;
  for (const allowed of allowedHosts) {
    if (host === allowed || host.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

function isRedirectStatus(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * 返回一组有序的上游候选 URL（按 fallback 顺序）。
 * 空数组表示该路径没有匹配的路由（或路径不安全），调用方应回 404。
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
    // 段校验：拒绝 "."/".."、含分隔符、超长段、超深路径（路径逃逸防线）
    if (rest.length === 0 || !isSafeSegmentList(rest)) return [];
    // /hf/{owner}/{repo}/... → 多个 huggingface 镜像依次回退（默认 hf-mirror.com → hf-api.cn）
    const pathTail = `${rest.map(encodeURIComponent).join("/")}${reqUrl.search}`;
    return getHfUpstreams().map((host) => new URL(`https://${host}/${pathTail}`));
  }
  if (kind === "gh-raw") {
    // /gh-raw/{owner}/{repo}/{branch}/{rest} → 多个 jsdelivr 镜像依次回退
    if (rest.length < 3 || !isSafeSegmentList(rest)) return [];
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
 * 超时 12s：cdn.jsdelivr.net 一旦被 QoS 限速，30s 内根本连不上，
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
      // 不切上游；释放 socket 避免连接泄漏（长时间高并发不 release 会耗尽 FD）。
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
  // 默认只回显本地 origin / 已鉴权来源，其余不设该头（浏览器按默认安全策略拒绝读取）。
  const corsOrigin = resolveCorsOrigin(req.headers.origin);
  if (corsOrigin) {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Accept, Content-Type, Range, If-None-Match, X-Proxy-Token",
  );
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

    // 跟随重定向（仅一次，cdn.jsdelivr.net 等常会把 /main 重定向到具体 commit）。
    // 安全约束：目标必须是 https 且命中镜像白名单，否则拒绝跟随——
    // 否则上游（或可控镜像）返回 Location: http://169.254.169.254/... 就变成 SSRF。
    if (isRedirectStatus(upstreamRes.statusCode)) {
      if (!PROXY_ALLOW_REDIRECTS) {
        upstreamRes.resume();
        res.setHeader("Cache-Control", "no-store");
        res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("dev-proxy: redirects disabled (PROXY_ALLOW_REDIRECTS=0)");
        return;
      }
      const location = upstreamRes.headers.location;
      if (location) {
        upstreamRes.resume();
        let redirected = null;
        try {
          redirected = new URL(location, upstream);
        } catch {
          redirected = null; // 非法 Location 一律按不可信处理
        }
        const upstreamHost = upstream.hostname ?? upstream.host;
        if (!isAllowedRedirect(redirected, upstreamHost)) {
          console.error(
            `[dev-proxy] 拒绝不可信重定向: ${upstreamHost} -> ${String(location).slice(0, 200)}`,
          );
          res.setHeader("X-Proxy-Worker", WORKER_HEADER);
          res.setHeader("Cache-Control", "no-store");
          res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("dev-proxy: untrusted redirect target");
          return;
        }
        const retry = await requestUpstreamWithRetry(redirected, req.method, headers);
        forwardHeaders(retry, res, { "X-Proxy-Upstream": upstreamHost });
        res.writeHead(retry.statusCode ?? 200);
        retry.pipe(res);
        return;
      }
    }

    forwardHeaders(upstreamRes, res, { "X-Proxy-Upstream": upstream.host });

    // 失败响应强制 no-store：避免 Service Worker 把 502/404 等错误缓存住，
    // 导致后续重试永远拿到同一个错误响应。
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
  server.listen(PORT, PROXY_HOST, () => {
    const upstreams = getGhRawUpstreams();
    console.log(`[dev-proxy] listening on http://${PROXY_HOST}:${PORT}`);
    const hfUpstreams = getHfUpstreams();
    console.log(`[dev-proxy] /hf/*          -> ${hfUpstreams.map((h) => `https://${h}/*`).join(" → ")}`);
    console.log(`[dev-proxy] /gh-raw/*      -> ${upstreams.map((h) => `https://${h}/gh/*`).join(" → ")}`);
    if (upstreams.length > 1) console.log(`[dev-proxy] (gh-raw 按上述顺序自动 fallback，可通过 GH_RAW_UPSTREAMS 环境变量覆盖)`);
    if (hfUpstreams.length > 1) console.log(`[dev-proxy] (hf 按上述顺序自动 fallback，可通过 HF_UPSTREAMS 环境变量覆盖)`);
    // 安全姿态一次性打印，便于确认"当前是不是开放代理"
    console.log(
      `[dev-proxy] 安全：监听 ${PROXY_HOST}${PROXY_HOST === "127.0.0.1" ? "（仅本机可访问）" : "（⚠️ 非回环，请确认已配 PROXY_TOKEN）"}；` +
        `token ${PROXY_TOKEN ? "已启用" : "未启用"}；3xx 跟随 ${PROXY_ALLOW_REDIRECTS ? "开启（白名单校验）" : "关闭"}`,
    );
    if (PROXY_CORS_ORIGINS) console.log(`[dev-proxy] CORS 白名单：${PROXY_CORS_ORIGINS}`);
  });
}
