/**
 * vite.embed.config.js — 嵌入式库构建
 *
 * 把 src/embed.js 打包为 ESM 单入口（chunk 按需加载，开箱即用）：
 *   dist-embed/local-agent.esm.js                入口（~161KB）
 *   dist-embed/index-*.js                        WebLLM 引擎 chunk（~6.3MB，首次加载模型时按需下载）
 *   dist-embed/transformers.web-*.js             Transformers.js 后端 chunk（BrowserAI 依赖，~63.8MB，仅 ONNX 模型按需加载）
 *
 * 体积为 `npm run build:embed` 实测值，随 SDK 版本变化。
 *
 * 用法：npx vite build --config vite.embed.config.js
 * 部署：整个 dist-embed/ 目录发布到同源路径即可（chunk 相对入口按需加载）。
 *      仅用 WebLLM / MLC 档位（不加载 Transformers.js / ONNX 模型）时，可不上传 transformers.web-*.js；
 *      反之加载 ONNX 模型会按需请求该 chunk，缺失将 404。详见 INTEGRATION.md「方式二」。
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
