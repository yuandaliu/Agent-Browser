/**
 * swStrategies.js — Service Worker 缓存策略函数（纯逻辑）
 *
 * 重要：这些函数被两处共用：
 *   1. public/sw.js（生产） —— SW 内调用，但 SW 不支持 ESM import，所以 SW 文件内
 *      inline 复制了相同实现（公开注释标记 SYNC-MARKER）。
 *   2. tests/unit/swStrategies.test.js（单测） —— 通过 ESM import 覆盖所有路径。
 *
 * 同步维护策略：每次修改本文件，请同步修改 public/sw.js 的相应函数；
 * 单元测试覆盖的即是这里的行为，所以 SW 出问题会立即被测试发现。
 *
 * 缓存策略矩阵：
 *   - 模型权重（/hf*, /hf-transformers*, /gh-raw*）   → cache-first（权重不变，命中即用）
 *   - 应用 chunks（/assets/*, /dist-embed/*）            → stale-while-revalidate
 *   - 导航请求（mode === "navigate"）                     → network-first with cache fallback
 */

/**
 * 判断 URL 是否为模型权重请求（命中 cache-first 策略）
 */
export function isModelRequest(url) {
  if (!url || !url.pathname) return false;
  return (
    url.pathname.startsWith("/hf/") ||
    url.pathname.startsWith("/hf-transformers/") ||
    url.pathname.startsWith("/gh-raw/")
  );
}

/**
 * 判断 URL 是否为应用 chunk（命中 stale-while-revalidate 策略）
 *
 * 注意：用 `endsWith` / `===` 而非 `includes`，避免被无关 URL（如 `/api/local-agent.esm.js`）
 * 误判为应用 chunk，导致缓存污染。SYNC-MARKER：public/sw.js 需同步修改。
 */
export function isAppChunkRequest(url) {
  if (!url || !url.pathname) return false;
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/dist-embed/") ||
    url.pathname === "/local-agent.esm.js" ||
    url.pathname.endsWith("/local-agent.esm.js")
  );
}

/**
 * Cache-first：命中即用，未命中走网络并缓存。
 * 适用：模型权重（不变的大文件）。
 *
 * 关键：fetch 拿到响应（不论 2xx/4xx/5xx）一律透传给调用方，不吞错，
 * 否则会在 DevTools 里掩盖 dev-proxy 的上游错误（如 502），只剩笼统的 503。
 * 仅在 fetch 直接 reject（真断网 / 网络层失败）且无缓存时才返回 503。
 *
 * @param {Request} req - 原始请求
 * @param {string} cacheName - Cache Storage 名称
 * @param {object} caches - Cache Storage 客户端（生产环境是全局 self.caches）
 * @param {function} fetchImpl - 可注入的 fetch（测试用，默认走全局 fetch）
 */
export async function cacheFirst(req, cacheName, caches, fetchImpl = globalThis.fetch) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  let res;
  try {
    res = await fetchImpl(req);
  } catch {
    // fetch 直接 reject（断网 / 网络层失败）且无缓存：返回 503，前端可降级
    return new Response("offline and no cache", { status: 503 });
  }
  if (res && res.ok) cache.put(req, res.clone());
  // 上游 4xx/5xx 透传，不入缓存也不吞错（DevTools 能直接看到 dev-proxy 的 502 body）
  return res;
}

/**
 * Stale-while-revalidate：返回缓存（若有）并后台刷新。
 * 适用：应用 chunks（hash 文件名保证更新时 URL 变化）。
 *
 * @param {Request} req
 * @param {string} cacheName
 * @param {object} caches
 * @param {function} fetchImpl
 */
export async function staleWhileRevalidate(req, cacheName, caches, fetchImpl = globalThis.fetch) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  // 后台更新（不等）
  const networkPromise = fetchImpl(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  // 立即返回缓存；若无缓存则等网络
  return cached || (await networkPromise) || new Response("", { status: 504 });
}

/**
 * Network-first with cache fallback：网络优先，离线时降级到缓存。
 * 适用：HTML 导航请求（避免 stale SW 卡住）。
 *
 * @param {Request} req
 * @param {string} appCacheName
 * @param {object} caches
 * @param {string} fallbackUrl - 离线时兜底的 HTML 路径
 * @param {function} fetchImpl
 */
export async function networkFirstWithCacheFallback(req, appCacheName, caches, fallbackUrl = "/index.html", fetchImpl = globalThis.fetch) {
  const cache = await caches.open(appCacheName);
  try {
    const res = await fetchImpl(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    // 终极兜底：返回根 index.html（确保 SPA 路由能 fallback 到入口）
    const fallback = await cache.match(fallbackUrl);
    return fallback || new Response("offline", { status: 503 });
  }
}

/**
 * 路由决策：根据请求 URL 返回应该使用的策略函数名。
 * 单元测试可验证决策正确性。
 */
export function pickStrategy(url, mode) {
  if (isModelRequest(url)) return "cacheFirst";
  if (isAppChunkRequest(url)) return "staleWhileRevalidate";
  if (mode === "navigate") return "networkFirstWithCacheFallback";
  return null; // 不拦截
}