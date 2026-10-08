/**
 * swStrategies.js — Service Worker 缓存策略函数（纯逻辑）
 *
 * 重要：这些函数被两处共用：
 *   1. public/sw.js（生产） —— SW 内调用，但 SW 不支持 ESM import，所以 SW 文件内
 *      inline 复制了相同实现（公开注释标记 SYNC-MARKER）。
 *   2. tests/unit/swStrategies.test.js（单测） —— 通过 ESM import 覆盖所有路径。
 *
 * 同步维护策略：每次修改本文件，请同步修改 public/sw.js 的相应函数。
 * 注意：单测（swStrategies.test.js）只覆盖本文件；public/sw.js 因 SW 不支持 ESM import
 * 无法被单测直接覆盖，由 tests/unit/swSync.test.js 做签名与路径一致性守卫——
 * 守卫只能防"两文件漂移"，不能验证 SW 实际运行行为，改动 sw.js 后务必手动验证。
 *
 * 缓存策略矩阵：
 *   - 模型权重（/hf*, /hf-transformers*, /gh-raw*）   → **不拦截**（模型缓存唯一交给 SDK）
 *   - 应用 chunks（/assets/*, /dist-embed/*）            → stale-while-revalidate
 *   - 导航请求（mode === "navigate"）                     → network-first with cache fallback
 *
 * 为什么模型权重不再由 SW 缓存（REVIEW.md A1）：
 * SDK 自己按 cacheBackend（本项目用 indexeddb）把权重写进 IndexedDB，且**缓存命中后不再发起
 * fetch**——本 SW 对同一批 URL 做的 cache-first 副本永远不会被读取，用户却永久多付一倍磁盘
 * （2B 档 ~1.2GB → 多占 ~1.2GB），还让"清理缓存"的承诺失真（SDK 的 deleteModelArtifacts()
 * 只清 IndexedDB 侧）。离线可用性不受影响：权重仍在 SDK 的 IndexedDB 里。
 */

/**
 * 判断 URL 是否为模型权重请求。
 *
 * 注意：命中本函数意味着"**不拦截**"（放行给浏览器默认网络行为），而不是"走 cache-first"。
 * 见文件头「为什么模型权重不再由 SW 缓存」。
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
 * 路由决策：根据请求 URL 返回应该使用的策略函数名；返回 null 表示"不拦截"。
 * 单元测试可验证决策正确性。
 *
 * `isModelRequest(url)` 分支返回 null 是**显式决策**（不是遗漏）：模型权重放行给浏览器
 * 默认网络行为，缓存唯一交给 SDK 的 IndexedDB（REVIEW.md A1）。保留该分支是为了让
 * "模型路径不参与任何 SW 缓存策略"这件事在代码里可见，也避免日后新增规则时误伤。
 */
export function pickStrategy(url, mode) {
  if (isModelRequest(url)) return null; // 显式放行：模型缓存唯一交给 SDK
  if (isAppChunkRequest(url)) return "staleWhileRevalidate";
  if (mode === "navigate") return "networkFirstWithCacheFallback";
  return null; // 不拦截
}