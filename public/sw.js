/**
 * local-llm-agent Service Worker — 离线缓存
 *
 * 功能：缓存应用壳（HTML/CSS/JS chunks），让用户在首次加载完成后，断网 / 跨页面仍能秒开。
 *       **不缓存模型权重**（原因见下）。
 *
 * 缓存策略：
 *   - 模型权重（/hf*, /hf-transformers*, /gh-raw*） → **不拦截**（模型缓存唯一交给 SDK）
 *   - 应用 chunks（/assets/*, /dist-embed/*）    → stale-while-revalidate
 *   - 导航请求（HTML）                          → network-first + cache fallback
 *
 * 为什么模型权重不再由 SW 缓存（REVIEW.md A1）：
 *   SDK 自己按 cacheBackend（本项目用 indexeddb）把权重写进 IndexedDB，且**缓存命中后不再
 *   发起 fetch**——SW 写的副本永远不会被读取，用户却永久多付一倍磁盘（2B 档 ~1.2GB → 多占
 *   ~1.2GB），还让"清理缓存"的承诺失真（SDK 的 deleteModelArtifacts() 只清 IndexedDB 侧）。
 *   离线可用性不受影响：权重仍在 SDK 的 IndexedDB 里。
 *
 * 重要：本文件的策略函数与 src/swStrategies.js 人工同步维护（见 swStrategies.js 顶部注释）。
 *       SW 不支持 ESM import，所以这里 inline 复制——每次改一处必须改另一处。
 *       单测只覆盖 src/swStrategies.js；本文件因 SW 限制无法被单测直接覆盖，
 *       由 tests/unit/swSync.test.js 做签名、路径与"不得再缓存模型"的守卫，
 *       改动后务必手动验证 SW 实际行为。
 *
 * 版本号：缓存**内容或策略**变化时递增 VERSION（activate 阶段会清理旧缓存）。
 *       v3 的必要性：模型权重已移出 SW 缓存，递增后 activate 会删掉历史遗留的
 *       local-agent-models-* 死副本，把用户被白占的磁盘收回来。因为那份副本本来就不会被
 *       读取（SDK 的 IndexedDB 缓存独立存在），所以**不会触发任何重新下载**。
 */

const VERSION = "v3";
const APP_CACHE = `local-agent-app-${VERSION}`;

// 应用 shell（离线 fallback 预缓存）
const APP_SHELL = ["/", "/index.html", "/search.html"];

// ============================================================
// 策略函数（SYNC-MARKER: 与 src/swStrategies.js 同步）
// ============================================================

// 命中本函数意味着"不拦截"（放行给浏览器默认网络行为），不是"走 cache-first"。
function isModelRequest(url) {
  if (!url || !url.pathname) return false;
  return (
    url.pathname.startsWith("/hf/") ||
    url.pathname.startsWith("/hf-transformers/") ||
    url.pathname.startsWith("/gh-raw/")
  );
}

function isAppChunkRequest(url) {
  if (!url || !url.pathname) return false;
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/dist-embed/") ||
    url.pathname === "/local-agent.esm.js" ||
    url.pathname.endsWith("/local-agent.esm.js")
  );
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await networkPromise) || new Response("", { status: 504 });
}

async function networkFirstWithCacheFallback(req, appCacheName) {
  const cache = await caches.open(appCacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    const fallback = await cache.match("/index.html");
    return fallback || new Response("offline", { status: 503 });
  }
}

// ============================================================
// 生命周期
// ============================================================

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      // 预缓存应用 shell（best-effort，单个失败不阻塞）
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
      // 立即接管，不让页面卡在旧 SW 上
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 清理旧版本缓存
      const keys = await caches.keys();
      // 只保留当前的 APP_CACHE：local-agent-models-* 是历史版本遗留的模型缓存死副本
      // （v3 起 SW 不再写模型权重），必须一并删除才能把被白占的磁盘收回来。
      const stale = keys.filter((k) => k.startsWith("local-agent-") && k !== APP_CACHE);
      await Promise.all(stale.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// ============================================================
// fetch 路由
// ============================================================

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // 只处理 GET
  const url = new URL(req.url);
  // 同源限制：跨域请求交给浏览器原生处理（避免 CORS 复杂度）
  if (url.origin !== self.location.origin) return;

  // 路由决策
  // 模型权重：显式放行、不拦截——模型缓存唯一交给 SDK 的 IndexedDB（见文件头说明）。
  if (isModelRequest(url)) return;
  if (isAppChunkRequest(url)) {
    event.respondWith(staleWhileRevalidate(req, APP_CACHE));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(networkFirstWithCacheFallback(req, APP_CACHE));
    return;
  }
  // 其他：不拦截，浏览器原生处理
});