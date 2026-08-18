/**
 * vite.config.js — 开发与构建配置
 *
 * 开发模式下，BrowserAI 使用 "proxy" 模型源，把模型下载地址重写为页面同源
 * 的 /hf/*、/hf-transformers/*、/gh-raw/*，由 Vite 转发到本地代理服务器
 * (server/dev-proxy.mjs, 端口 8787)，再转发到 hf-mirror.com / jsdelivr。
 *
 * 启动：npm run proxy   （另开终端）
 *       npm run dev
 */
import { defineConfig } from "vite";

const MODEL_PROXY_TARGET = process.env.PROXY_TARGET ?? "http://localhost:8787";

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
