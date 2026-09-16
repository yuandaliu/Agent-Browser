# 集成指南：把本地智能体嵌入已有 Web 页面

本项目的核心（模型加载 / ReAct 循环 / 工具 / 记忆 / 页面读取）与 UI 完全解耦，可以像组件一样嵌入
任意已有页面。提供三种接入方式，按宿主工程的构建能力选择。

## 1. 选择接入方式

| 问题 | 分支 |
| --- | --- |
| 宿主页面有无构建工具（Vite / Webpack）？ | 有 → **方式一**（npm 源码复用）；无 → **方式二**（单文件产物） |
| 宿主站点部署在哪？（Vercel / Netlify / 自建） | 决定第 2 节的代理配置 |
| 宿主要求零代码接入？ | 是 → **方式三**（iframe） |

## 2. 前置条件：模型下载代理（必需，否则模型下载会失败）

模型权重托管在 HuggingFace（国内无法直连），嵌入页面必须能访问**同源**的 `/hf/*`、`/hf-transformers/*`、
`/gh-raw/*` 路由（`createLocalAgent` 默认 `modelSource: "proxy"`，即请求这些路径）。

| 宿主部署位置 | 方案 |
| --- | --- |
| **Vercel** | 宿主仓库根目录放 `vercel.json`（内容见本仓库），`rewrites` 转发 `/hf/* → hf-mirror.com`、`/gh-raw/* → jsdelivr`。宿主已有 `vercel.json` 时，把 `rewrites` 数组合并进去 |
| **Netlify** | 放 `netlify.toml`，用 `[[redirects]] status=200 force=true` 透明代理（同样合并）。注意 gh-raw 路径重排限制，见 `README.md` |
| **Cloudflare Worker / 自建服务器** | 部署 `server/dev-proxy.mjs`（Node）或 BrowserAI 仓库的 `worker-template/`，宿主页面配置 `proxyOrigin` 指向它 |
| **完全离线 / 内网** | 用 `npx serve` 之类静态托管模型文件，或改造代理指向内网镜像 |

> 宿主域名与代理不同源时：`createLocalAgent({ proxyOrigin: "https://代理域名" })`；代理已内置 CORS 头
> （`server/dev-proxy.mjs`）。

## 3. 方式一：npm / 源码复用（宿主工程有构建工具，推荐）

体积最小、可定制最强。

```bash
# 在宿主工程中安装依赖
npm install @missionsquad/browserai
```

把以下 **9 个文件**拷入宿主工程（或发布为私有 npm 包后 install）：

```
src/embed.js           嵌入式 API（唯一入口）
src/agentLoop.js       ReAct 循环
src/tools.js           工具系统
src/toolSchemas.js     由 TOOLS 派生的 JSON Schema / OpenAI tools 格式
src/contextBudget.js   上下文预算裁剪与记忆条目校验
src/pageReader.js      页面实时内容读取
src/memory.js          IndexedDB 记忆
src/modelLoader.js     模型加载引擎
src/failureLog.js      失败对话调试日志
```

> - 除 `embed.js` 外均为**无 DOM 依赖**的纯逻辑模块（`pageReader.js` 在无 DOM 环境自动降级），可整体移植。
> - 依赖关系：`agentLoop.js` → `contextBudget.js` / `toolSchemas.js`；`tools.js` → `pageReader.js` /
>   `contextBudget.js`；`toolSchemas.js` → `tools.js`；`failureLog.js` → `contextBudget.js`。拷贝时勿遗漏。

宿主代码：

```js
// 你的页面中
import { createLocalAgent } from "./embed.js";

const agent = createLocalAgent({
  // modelId 留空或传 "auto"（默认）：ready() 内部探测硬件（WebGPU + 核数），
  // 通过 onEvent 的 "model-recommended" 事件告知推荐档位，下拉自动切到该项
  // modelId: "Qwen3.5-2B-q4f16_1-MLC",  // 也可显式指定
  onProgress: ({ progress, status }) => renderProgressBar(progress, status), // 0-1
  onReady: ({ modelId }) => enableChatUI(modelId),
  onError: (err) => showError(err.message),
  onEvent: (e) => {
    if (e.type === "model-recommended") console.log(`为你的设备推荐：${e.modelId}`);
  },
});

// 页面加载后初始化
await agent.ready();

// 用户点击“加载模型”（默认走 ready() 推荐档，也可显式指定）
await agent.load();

// 用户发送消息
const { answer } = await agent.chat("现在几点", {
  onStep: (step) => {
    // step.type: "stream" | "action" | "observation" | "final" | "error"
    if (step.type === "action") log(`调用工具: ${step.name}`);
  },
  onDelta: (fullText) => renderStreaming(fullText), // 流式输出
});
```

### API 一览

`createLocalAgent(options)` 返回：

| 方法 | 说明 |
| --- | --- |
| `ready()` | 初始化（IndexedDB + WebGPU 探测 + 事件订阅 + **启动页面实时内容监听**），幂等 |
| `load(modelId?)` | 加载模型（默认 `options.modelId` / 推荐档），单飞保护；id 不在 SDK 目录时降级到最低可用档并 `console.warn` |
| `unload()` / `dispose()` | 卸载模型 / 完全销毁（含停止页面监听、释放 WebGPU 上下文与 worker） |
| `chat(text, { onStep, onDelta })` | 对话，自动写入历史；返回 `{ answer, steps, rawTexts }`；输入为空或模型未加载会抛错 |
| `isModelLoaded()` / `getLoadedModelId()` | 加载状态查询 |
| `getRecommendedModelId()` / `getAvailableModels()` | 推荐档位 / 可用档位列表 |
| `getStats()` / `clearStats()` | 性能快照（字段见 `README.md`「性能与可观测性」）/ 清空 |
| `getHistory()` / `clearHistory()` | 对话历史读写（跨轮上下文） |
| `getMemories()` / `saveMemory(k, v)` / `recallMemory(q)` / `clearMemories()` | 长期记忆 |
| `getFailureLog()` / `clearFailureLog()` | 失败对话调试日志（最近 20 条） |
| `getSWRegistration()` | 当前 Service Worker 注册对象 |
| `_ai` / `_memory` | 底层 SDK 与记忆实例（高级用法） |

构造参数（`options`）：

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `modelId` | `"auto"` → Qwen3.5-2B | 同步 fallback 为 Qwen3.5-0.8B；`ready()` 后按硬件推荐为 Qwen3.5-2B |
| `modelSource` | `"proxy"` | `"proxy"` 走同源路由下载；`"direct"` 直连 HuggingFace |
| `proxyOrigin` | 本地 127.0.0.1 / 托管页面同源 | 本地强制 IPv4 loopback；远程部署用 `location.origin` |
| `verifyProxy` | 本地 true / 托管 false | 是否探测代理健康 |
| `maxSteps` | 5 | ReAct 最大循环步数 |
| `memoryAdapter` | `null`（IndexedDB） | 自定义记忆适配器 |
| `onEvent` | — | 统一事件回调（`progress` / `status` / `ready` / `hardware` / `error` / `model-recommended`） |
| `onProgress` / `onStatus` / `onReady` / `onError` | — | 拆分的加载事件回调 |

> 智能体内置 `read_page_content` 工具：可读取**当前嵌入页面**的实时内容（标题 / URL / 正文，
> MutationObserver 实时缓存）。宿主也可直接 `import { getPageSnapshot } from "./pageReader.js"` 自行调用。
> iframe 跨域场景需宿主用 `postMessage` 推送页面内容。

## 4. 方式二：单文件产物（宿主页面无构建工具）

先用本项目仓库构建出 ESM 单入口：

```bash
npm install
npm run build:embed        # 产出 dist-embed/
```

把 **整个 `dist-embed/` 目录**部署到宿主站点的同源路径（例如 `/local-agent/`），然后：

```html
<!-- 宿主页面：任意位置加入 -->
<script type="module">
  import { createLocalAgent, getModelOptions } from "/local-agent/local-agent.esm.js";

  const agent = createLocalAgent({
    onReady: () => console.log("模型就绪"),
    onError: (err) => console.error(err),
  });
  await agent.ready();
  // …与方式一相同的调用方式
</script>
```

> **产物体积**（`npm run build:embed` 实测，随 SDK 版本变化）：
> - 入口 `local-agent.esm.js` 约 161KB（gzip 43KB）；
> - WebLLM 引擎 chunk 约 6.3MB（gzip 2.2MB），首次 `load()` 时按需下载；
> - Transformers.js 后端 chunk 约 63.8MB（gzip 17.6MB），仅在选用 ONNX 模型时加载。
>
> 方式二默认需把**整个 `dist-embed/` 目录**（约 70MB）上传到宿主同源路径，请确认静态托管的单文件体积与总容量允许。
> 两个 chunk 都是运行时动态 `import()`，入口不含 `modulepreload`，不影响页面首屏。
>
> **可以省掉 63.8MB 的情况**：仅当宿主只用 WebLLM / MLC 后端（即本项目 `MODEL_OPTIONS` 里的 3 个 `Qwen3.5-*-MLC` 档，
> 且不会显式 `load()` 任何 Transformers.js（ONNX）模型）时，该 chunk 永远不会被请求，可在部署时不上传
> `dist-embed/transformers.web-*.js`（按通配匹配，文件名含构建 hash，每次构建都会变；本地构建产物保留，
> 后续要用随时补传）。反之，一旦加载 `transformers-js` 后端的模型就会按需请求它，缺失将直接 404 导致加载失败。
> 部署后可自检：F12 → Network，正常对话路径下不应出现 `transformers.web-*.js` 的请求。
>
> 完整聊天 UI 可参考本仓库 `demo/embed-demo.html`。

**本地联调**：把下面内容保存为 `embed-test.html`，与 `dist-embed/` 放在同一目录，用任意静态服务器打开
（如 `npx serve .` 或 `python -m http.server`），验证能否跑通：

```html
<script type="module">
  import { createLocalAgent } from "./dist-embed/local-agent.esm.js";
  const agent = createLocalAgent({
    onProgress: ({ progress }) => console.log("加载进度", Math.round(progress * 100) + "%"),
    onReady: () => console.log("✅ 模型已就绪"),
    onError: (err) => console.error(err),
  });
  await agent.ready();
  await agent.load();               // 首次需下载推荐档（默认约 1.2GB），务必先配好第 2 节的代理
  const { answer } = await agent.chat("现在几点", {});
  console.log("回复:", answer);
</script>
```

**验证**：

- 自动化：本仓库 `npm run test:embed`（需先起 proxy 与 dev）验证完整浮窗示例；
- 手动：在页面对话框依次验证时间、计算、记忆三类问题，逐条核对结果；
- 网络：浏览器 F12 → Network，确认模型文件经 `/hf/...` 返回 200 且无 CORS 报错。

## 5. 方式三：iframe 嵌入（最省事，零代码）

把本项目直接部署为一个独立站点，宿主页面用 iframe 引入：

```html
<iframe src="https://your-agent.example.com/" width="400" height="600"
        style="border:none; border-radius:16px; box-shadow:0 8px 24px rgba(0,0,0,.2)"></iframe>
```

- 优点：无需任何集成代码，独立迭代。
- 缺点：样式与交互与宿主页面隔离；需要把模型代理同时部署在 agent 站点（见第 2 节）。

## 6. 模型选择（设备自适应）

默认 `modelId: "auto"`：`ready()` 会调用 `ai.probeHardware()` 探测 WebGPU 与核心数，按启发式算法选出档位，
触发 `onEvent({ type: "model-recommended", modelId, snapshot })`，用户仍可从下拉手动覆盖。宿主想跳过自动选档，
显式指定即可：

```js
const agent = createLocalAgent({ modelId: "Qwen3.5-2B-q4f16_1-MLC" });
```

> 传入的 id 必须存在于 SDK 模型目录（`MODEL_PRESETS`）；失效 id 会在 `load()` 时降级到最低可用档并输出 `console.warn`。

档位清单、自适应规则与新增模型步骤见 `README.md`「模型选择与设备自适应」；元数据定义在
`src/modelLoader.js` 的 `MODEL_OPTIONS`（tier / sizeMB / minVRAMGB / minCores / recommended）。

## 7. 浏览器要求：WebGPU

本地 1B 模型推理需要 WebGPU：Chrome / Edge 最新版（开启硬件加速），建议独立显卡。无 GPU 环境会降级为
软件渲染，速度很慢或不可用。宿主代码建议先检测：

```js
const agent = createLocalAgent({ onError: (err) => {
  if (String(err.message).includes("WebGPU")) showBanner("请使用支持 WebGPU 的浏览器");
}});
await agent.ready(); // ready() 内部会探测硬件并通过 onError 报告
```

## 8. 首次加载体验

- 首次 `load()` 需下载数百 MB 权重（Qwen3.5-0.8B 约 447MB，默认档 2B 约 1.2GB），**务必把进度回调渲染出来**；
- 权重缓存在浏览器 Cache / IndexedDB（按域名隔离），二次加载秒级；
- 建议在 UI 上提示“首次加载较慢，之后秒开”。

## 9. Service Worker 行为（宿主须知）

`createLocalAgent()` 在 `ready()` 中会自动注册 `public/sw.js`。注册策略：

| 场景 | 行为 |
| --- | --- |
| 正常页面（页面域与嵌入域一致） | 注册成功，断网 / 跨页面仍可用 |
| iframe 嵌入（iframe 加载嵌入脚本） | 取决于宿主页面的 `Content-Security-Policy` / `Service-Worker-Allowed` 头，可能被拒绝 |
| 跨源 iframe | 注册失败（浏览器安全策略） |
| 非 HTTPS / 非 localhost | 注册失败（SW 强制 HTTPS） |
| 浏览器不支持 SW（如早期 Safari） | 静默跳过，无任何错误 |

- **想让 SW 工作**：同源直接嵌入开箱即用；iframe 场景宿主的 `<iframe allow=... sandbox=...>` 需允许 SW
  （多数浏览器默认允许）；跨域嵌入需把 `public/sw.js` 上传到宿主站点根路径，并修改 `src/embed.js` 的
  `register("/sw.js")` 为实际路径。
- **想禁用 SW**：调用 `navigator.serviceWorker.getRegistrations()` 后 `unregister()`，或 fork `embed.js` 跳过注册。
- **清除缓存**：宿主可提供按钮调用 `caches.delete("local-agent-models-v2")` 让用户清理磁盘空间
  （缓存名与策略见 `README.md`「离线缓存」）。

## 10. 与宿主页面共存要点

- **样式隔离**：`embed.js` 不注入任何样式；浮窗 UI（`demo/embed-demo.html` 的 `#la-*` 选择器）使用带前缀的
  类名，避免与宿主冲突。也可改用 Shadow DOM 挂载。
- **无全局污染**：不修改 `window`、不拦截事件；仅占用一个 IndexedDB 数据库 `local-llm-agent`（消息历史 + 记忆）。
- **并发**：`chat()` 与 `load()` 均有单飞保护（同时只能有一个对话 / 一次加载在跑）。
- **销毁**：页面卸载前调用 `agent.dispose()` 释放 WebGPU 上下文与 worker。

## 11. 上线检查清单

- [ ] 页面能打开且无控制台报错
- [ ] 「加载模型」进度条 0→100%，二次打开走缓存秒开
- [ ] 对话流式输出正常，思考过程（Action / Observation）可见
- [ ] 首次加载提示已呈现（默认档约 1.2GB，请耐心等待）
- [ ] 不支持 WebGPU 的浏览器有降级提示（`onError` 分支）
- [ ] 已处理与宿主页面的样式冲突（浮窗类名加前缀或 Shadow DOM）
