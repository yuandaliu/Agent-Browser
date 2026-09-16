/**
 * vite.config.js — 开发与构建配置
 *
 * 开发模式下，BrowserAI 使用 "proxy" 模型源，把模型下载地址重写为页面同源
 * 的 /hf/*、/hf-transformers/*、/gh-raw/*，由 Vite 转发到本地代理服务器
 * (server/dev-proxy.mjs, 端口 8787)，再转发到 hf-mirror.com / jsdelivr 等镜像。
 *
 * 注意：默认 target 使用 127.0.0.1（IPv4 loopback）而非 localhost，
 * 避免 Vite 把 "localhost:8787" 解析到 ::1 (IPv6) 时连不上 dev-proxy。
 * 若需远程 dev-proxy，可通过 PROXY_TARGET 环境变量覆盖。
 *
 * 启动：npm run proxy   （另开终端）
 *       npm run dev
 */
import { defineConfig } from "vite";

const MODEL_PROXY_TARGET = process.env.PROXY_TARGET ?? "http://127.0.0.1:8787";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5189,
    proxy: {
      "/__worker-health": { target: MODEL_PROXY_TARGET, changeOrigin: true },
      "/hf": { target: MODEL_PROXY_TARGET, changeOrigin: true },
      "/hf-transformers": { target: MODEL_PROXY_TARGET, changeOrigin: true },
      "/gh-raw": { target: MODEL_PROXY_TARGET, changeOrigin: true },
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    chunkSizeWarningLimit: 2048,
  },
});
