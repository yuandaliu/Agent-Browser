/**
 * local-llm-agent Service Worker — 离线缓存
 *
 * 功能：缓存应用壳（HTML/CSS/JS chunks）+ 模型权重（/hf*、/hf-transformers*、/gh-raw*）
 *       让用户在首次加载完成后，断网 / 跨页面仍能秒开。
 *
 * 缓存策略：
 *   - 模型权重                                  → cache-first（权重不变）
 *   - 应用 chunks（/assets/*, /dist-embed/*）    → stale-while-revalidate
 *   - 导航请求（HTML）                          → network-first + cache fallback
 *
 * 重要：本文件的策略函数与 src/swStrategies.js 同步维护（见 swStrategies.js 顶部注释）。
 *       SW 不支持 ESM import，所以这里 inline 复制。每次改一处必须改另一处，
 *       单元测试（tests/unit/swStrategies.test.js）保证两者行为一致。
 *
 * 版本号：升级缓存策略或修改了 SW 内任意函数时同步递增 VERSION，activate 阶段会自动清理旧缓存。
 * cacheFirst 在 fetch 拿到 4xx/5xx 时透传上游响应，不替换为 503——否则会掩盖真实错误。
 */

const VERSION = "v2";
const MODEL_CACHE = `local-agent-models-${VERSION}`;
const APP_CACHE = `local-agent-app-${VERSION}`;

// 应用 shell（离线 fallback 预缓存）
const APP_SHELL = ["/", "/index.html", "/search.html"];

// ============================================================
// 策略函数（SYNC-MARKER: 与 src/swStrategies.js 同步）
// ============================================================

async function isModelRequest(url) {
  if (!url || !url.pathname) return false;
  return (
    url.pathname.startsWith("/hf/") ||
    url.pathname.startsWith("/hf-transformers/") ||
    url.pathname.startsWith("/gh-raw/")
  );
}

async function isAppChunkRequest(url) {
  if (!url || !url.pathname) return false;
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/dist-embed/") ||
    url.pathname === "/local-agent.esm.js" ||
    url.pathname.endsWith("/local-agent.esm.js")
  );
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  let res;
  try {
    res = await fetch(req);
  } catch {
    // 真正断网（fetch 直接 reject）：返回 503，前端可降级
    return new Response("offline and no cache", { status: 503 });
  }
  if (res && res.ok) cache.put(req, res.clone());
  // 上游 4xx/5xx：透传，不吞掉 dev-proxy 的错误信息（让 DevTools 直接看到真实 502）
  return res;
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
      const stale = keys.filter(
        (k) =>
          (k.startsWith("local-agent-models-") || k.startsWith("local-agent-app-")) &&
          k !== MODEL_CACHE &&
          k !== APP_CACHE,
      );
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
  if (isModelRequest(url)) {
    event.respondWith(cacheFirst(req, MODEL_CACHE));
    return;
  }
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