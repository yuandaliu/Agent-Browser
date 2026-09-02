/**
 * vite.embed.config.js — 嵌入式库构建
 *
 * 把 src/embed.js 打包为 ESM 单入口（chunk 按需加载，开箱即用）：
 *   dist-embed/local-agent.esm.js                入口（~131KB）
 *   dist-embed/index-*.js                        WebLLM 引擎 chunk（首次加载模型时按需下载）
 *   dist-embed/transformers.web-*.js             Transformers.js 后端 chunk（BrowserAI 依赖，按需加载）
 *
 * 用法：npx vite build --config vite.embed.config.js
 * 部署：整个 dist-embed/ 目录发布到同源路径即可（chunk 相对入口按需加载）。
 */
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist-embed",
    emptyOutDir: true,
    target: "es2022",
    minify: "esbuild",
    sourcemap: false,
    lib: {
      entry: "src/embed.js",
      name: "LocalAgent",
      formats: ["es"],
      fileName: () => "local-agent.esm.js",
    },
  },
});
