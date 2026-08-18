# 🤖 本地智能体 · Local Agent

一个**完全在浏览器中运行**的本地小模型智能体：基于 [@missionsquad/browserai](https://github.com/MissionSquad/BrowserAI)
（WebGPU / WebLLM）加载 1B 级开源模型，实现 **ReAct（思考-行动-观察）循环**、**工具系统**
（时间 / 计算 / 搜索 / 记忆）与 **IndexedDB 持久化记忆**，并提供流式输出的现代化聊天界面。

对话不上传服务器，模型权重下载一次后由浏览器缓存，之后离线可用（权重在本地 IndexedDB/Cache）。

---

## 📚 文档索引

| 文档 | 内容 |
| --- | --- |
| **`USAGE.md`** | 📖 使用流程总览：本地体验 / 嵌入页面 / 部署上线 / 测试验证 四场景 |
| **`VERIFICATION.md`** | ✅ 手动验收清单（逐项勾选，含各阶段验收标准） |
| **`INTEGRATION.md`** | 🔌 嵌入已有页面的三种方式与前提条件 |
| **`README.md`** | 本文件：功能、架构、快速开始 |

---

## ✨ 功能总览（对应验收标准）

| 阶段 | 功能 | 验收点 |
| --- | --- | --- |
| Phase 1 | 环境与基础骨架 | 打开页面可见加载按钮，控制台无报错 |
| Phase 2 | 模型加载引擎（`src/modelLoader.js`） | 进度条 0% → 100%，控制台输出「模型已就绪」 |
| Phase 3 | ReAct 核心循环（`src/agentLoop.js`） | 输入“现在几点”，智能体调用时间工具并回复 |
| Phase 4 | 工具系统 + 记忆（`src/tools.js` / `src/memory.js`） | 记住上一轮对话；两位数加减乘除 |
| Phase 5 | UI 美化 + 流式输出 + 部署 | 界面美观、交互流畅，可部署 Vercel/Netlify |

## 🚀 快速开始

环境要求：Node.js 20+；浏览器需支持 **WebGPU**（Chrome / Edge 最新版，建议独显）。

```bash
# 1. 安装依赖
npm install

# 2. 启动模型下载代理（新开一个终端）
npm run proxy
#    [dev-proxy] listening on http://localhost:8787

# 3. 启动开发服务器（再开一个终端）
npm run dev
#    打开 http://127.0.0.1:5189
```

> 为什么需要代理？模型权重托管在 HuggingFace，国内网络无法直连。
> `dev-proxy` 把 SDK 的模型下载请求（`/hf/*`、`/gh-raw/*`）转发到国内可访问的
> **hf-mirror.com** 与 **jsdelivr CDN**，页面保持同源、无需 CORS 配置。

浏览器打开页面后点击「加载模型」：
- 首次加载需下载约 447MB 权重（Qwen3.5 0.8B q4），之后走浏览器缓存，秒开；
- 加载完成后控制台输出 `✅ 模型已就绪`，进度条 100%，即可开始对话。

### 试试这些

```
现在几点                      → 调用 get_current_time
12*34 等于多少                → 调用 calculate（安全 AST 求值，非 eval）
总结一下这个页面讲了什么      → 调用 read_page_content（读取当前嵌入页面实时内容）
我叫小明，请记住              → 调用 save_memory（IndexedDB 长期记忆）
我叫什么名字                  → 从对话历史 / 长期记忆作答
帮我搜索 WebGPU 是什么         → 调用 web_search（DuckDuckGo / 维基百科降级）
```

## 🔌 嵌入已有页面

核心逻辑与 UI 完全解耦，可把智能体作为组件嵌入任意已有 Web 页面（聊天浮窗、客服助手等）：

```js
import { createLocalAgent } from "./src/embed.js";

const agent = createLocalAgent({ onProgress: renderBar, onReady: enableChat, onError: showError });
await agent.ready();
await agent.load();                                    // 加载 1B 模型（进度 0-100）
const { answer } = await agent.chat("现在几点", { onStep, onDelta });  // 对话 + 流式
```

提供三种接入方式（npm 源码复用 / 单文件产物 `<script>` / iframe），详见
**`INTEGRATION.md`**；可运行的嵌入示例见 **`demo/embed-demo.html`**
（模拟已有网站右下角聊天浮窗，已通过 6/6 自动化验证）。

项目还内置一个**仿百度搜索页**（`search.html`）：页面主体仅作展示，智能体以
**右下角悬浮球 + 聊天弹窗**方式嵌入——点击悬浮球弹出聊天弹窗（宽 600px、高为页面 70%），
在弹窗内启动模型后进行问答（现在几点 / 12*34 等），流式展示 AI 回答与工具调用过程
（已通过 11/11 自动化验证）。

```bash
npm run build:embed   # 构建嵌入单文件产物（dist-embed/）
npm run test:embed    # 嵌入示例自动化验证（需先启动 proxy 与 dev）
```

## 🧠 架构

```
index.html ──┐
src/main.js  ── 组装：UI 事件、流式渲染、进度条
├─ src/modelLoader.js   模型加载引擎（WebGPU 探测、loadprogress 订阅、就绪事件）
├─ src/agentLoop.js     ReAct 循环：生成 → 解析(Thought/Action/Input) → 执行工具 → Observation → 循环/结束
│    └─ 高容错解析器：标准块 / JSON 工具调用 / 内联调用 / 全角符号 / 死循环保护
├─ src/tools.js         工具注册表：get_current_time / calculate / web_search / read_page_content / save_memory / recall_memory
├─ src/pageReader.js    页面实时内容读取：正文提取 + 智能截断 + MutationObserver 实时缓存 + SPA 路由监听
├─ src/memory.js        IndexedDB：对话历史（跨轮记忆）+ 长期事实记忆
└─ src/style.css        深色渐变聊天 UI、打字机流式输出、思考过程折叠块

server/dev-proxy.mjs    本地模型代理：/hf* → hf-mirror.com，/gh-raw* → jsdelivr（含健康检查）
```

## 🧪 测试

```bash
npm test                # 单元测试（vitest，44 项）：解析器、计算器、工具、记忆
npm run test:e2e        # E2E 验收（Playwright + 系统 Chrome + WebGPU，需先启动 proxy 与 dev）
node tests/e2e-probe.mjs  # 快速探测：页面 / WebGPU / 控制台
```

E2E 覆盖全部阶段验收点：进度条 0→100%、控制台「模型已就绪」、时间工具、两位数乘法（12×34=408）、
跨轮记忆（“我叫小明”→“我叫什么名字”）、长期记忆工具、界面元素、控制台零报错。

## ☁️ 部署（Vercel / Netlify）

生产环境无需本地代理：平台的 **rewrites / redirects** 会把同源 `/hf/*`、`/gh-raw/*`
请求透明转发到 hf-mirror.com / jsdelivr（详见 `vercel.json` / `netlify.toml`）。

```bash
npm run build           # 产出 dist/
```

- **Vercel**：导入仓库即可，自动识别 `vercel.json`（构建命令与外部 URL rewrites 已配置）。
- **Netlify**：导入仓库，构建命令 `npm run build`、发布目录 `dist`，自动识别 `netlify.toml`。

> 页面在生产环境自动检测为非 localhost，会以 `verifyProxy: false` 运行（平台转发无法附加
> `X-Proxy-Worker` 头）。也可把 `server/dev-proxy.mjs` 部署为 Cloudflare Worker 以获得完整
> 健康检查能力（参见 BrowserAI 仓库的 `worker-template/`）。

## 🧩 可选：更换模型

页面左侧下拉可选 5 个 1B 级模型，默认 **Qwen3.5 0.8B**（官方推荐）：

| 模型 ID | 下载 / 显存 |
| --- | --- |
| `Qwen3.5-0.8B-q4f16_1-MLC`（默认） | ~447MB / 1.6GB |
| `gemma3-1b-it-q4f16_1-MLC` | 更小 / ~711MB |
| `Llama-3.2-1B-Instruct-q4f16_1-MLC` | ~1B / 中 |
| `OLMo-2-0425-1B-Instruct-q4f16_1-MLC` | ~1B / 中 |
| `onnx-community/granite-4.0-1b-ONNX-web` | Transformers.js 后端 |

## 📁 目录结构

```
├── index.html / vite.config.js / package.json
├── src/            # 应用源码（main / modelLoader / agentLoop / tools / memory / style）
├── server/         # 本地模型代理服务器
├── tests/          # 单元测试 + E2E 验收脚本
├── vercel.json     # Vercel 部署配置（rewrites → 镜像）
└── netlify.toml    # Netlify 部署配置（redirects → 镜像）
```

## ⚠️ 已知限制

- 文本模型需要 WebGPU（浏览器硬件加速开启）；无独显时可能回退软件渲染、速度较慢。
- 1B 级小模型对工具调用的格式遵循存在不确定性：解析器已做多格式容错 + 死循环保护，
  但仍偶有答非所问；换更大的模型（2B/4B）可显著提升稳定性。
- 搜索工具依赖 DuckDuckGo / 维基百科的公网可达性，失败时自动降级并返回说明。



## 目前发现的限制
- 对话记录如果需要保存，浏览器可存储内容过小，而且长时间存储浏览器臃肿，影响性能。
- 如果存入后端数据库，需要额外配置数据库连接，增加复杂度，而且失去离线能力。
- 读取当前页面的内容，需要指定选择器，否则会读取整个页面内容。
- 小模型能力太弱，只能处理简单的任务，如时间、计算、搜索等。
- 嵌入方式仅支持单页面应用（SPA），不支持多页面应用（MPA），在 MPA 中嵌入智能体，不能依赖“内存”和“页面生命周期”。要把智能体当作一个“本地数据库驱动”的应用，依靠 IndexedDB 存数据，依靠 Service Worker 存模型，让智能体成为挂在浏览器硬盘上的独立服务，而不是挂在页面 DOM 上的临时脚本。
