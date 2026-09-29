/**
 * vite.embed.config.js — 嵌入式库构建
 *
 * 把 src/embed.js 打包为 ESM 单入口（chunk 按需加载，开箱即用）：
 *   dist-embed/local-agent.esm.js                入口（实测 ~157KB / gzip 42KB）
 *   dist-embed/index-*.js                        WebLLM 引擎 chunk（实测 ~6.0MB / gzip 2.1MB，首次加载模型时按需下载）
 *   dist-embed/transformers.web-*.js             Transformers.js 后端 chunk（实测 ~60.9MB / gzip 16.9MB，仅 ONNX 模型按需加载）
 *   dist-embed/sw.js                             离线缓存 Service Worker（~5KB）
 *
 * 体积为 2026-09-27 在 SDK 0.1.0 / web-llm 0.2.84 下 `npm run build:embed` 的实测值，
 * 随 SDK 与构建版本变化——改动依赖后请重新测量并同步 INTEGRATION.md 的「产物体积」段。
 *
 * 用法：npx vite build --config vite.embed.config.js
 * 部署：整个 dist-embed/ 目录发布到同源路径即可（chunk 相对入口按需加载，实测合计约 67MB）。
 *      仅用 WebLLM / MLC 档位（不加载 Transformers.js / ONNX 模型）时，可不上传 transformers.web-*.js
 *      （省下约 61MB）；反之加载 ONNX 模型会按需请求该 chunk，缺失将 404。
 *      注意：多模态（VLM）与语音（Whisper / TTS）档位都走 Transformers.js 后端，启用它们就不能省这个 chunk。
 *      详见 INTEGRATION.md「方式二」。
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
