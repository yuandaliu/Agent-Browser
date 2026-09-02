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
  > ⚠️ Netlify 的 redirects 无法完成 `gh-raw/{owner}/{repo}/{branch}/{path}` → jsdelivr 的路径重排，
  > 目前仅配置了 `mlc-ai/binary-mlc-llm-libs@main` 一条固定规则。若更换模型或 SDK 升级需要从
  > 其他 GitHub 仓库拉取文件，Netlify 部署会 404——此时请改用 Vercel 或自建 Cloudflare Worker 代理。

> 页面在生产环境自动检测为非 localhost，会以 `verifyProxy: false` 运行（平台转发无法附加
> `X-Proxy-Worker` 头）。也可把 `server/dev-proxy.mjs` 部署为 Cloudflare Worker 以获得完整
> 健康检查能力（参见 BrowserAI 仓库的 `worker-template/`）。

> ⚠️ **公网部署安全**：把 `dev-proxy.mjs` 部署为公网可访问的服务前，务必设置 `PROXY_TOKEN`
> 环境变量开启访问令牌校验（请求需携带 `X-Proxy-Token` 头或 `?token=` 参数），否则代理会
> 沦为开放镜像中转站，带来流量成本与合规风险。此外模型权重来自 hf-mirror 等第三方镜像，
> 属供应链信任范畴，请知悉。

## 🧩 可选：更换模型

页面左侧下拉可选 3 个模型，默认 **Qwen3.5 0.8B**（低门槛，官方推荐）：

| 模型 ID | 下载 / 显存 |
| --- | --- |
| `Qwen3.5-0.8B-q4f16_1-MLC`（默认） | ~447MB / 1.6GB |
| `Qwen/Qwen3.5-2B` ⚠️ 待实测 | ~1GB / ~2.2GB |
| `Qwen3.5-4B-q4f16_1-MLC` | ~2.4GB / ~3.8GB |

> ⚠️ `Qwen/Qwen3.5-2B` 的 id 格式与其他 `q4f16_1-MLC` 后缀模型不一致，MLC 后端可能无对应编译权重。
> 首次使用前请在本地实测能否加载；若加载失败，请从 `src/modelLoader.js` 的 `MODEL_OPTIONS` 移除该选项。

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

---

## 📋 最近变更（Changelog）

最近两轮未发布的代码变更汇总。提交后可作为 release notes。

### 🆕 本轮：P0 鲁棒性强化（4 项）

| # | 主题 | 涉及文件 | 关键变更 |
|---|---|---|---|
| **P0-1** | 构建产物不入库 | `.gitignore` | 补 `dist-embed/`（之前漏了，导致 2265 行构建产物被跟踪），同时规范化 coverage / vite / .env / 编辑器配置忽略；3 个 chunk 从 git 索引移除 |
| **P0-2** | 失败对话调试日志 | `src/failureLog.js`（新增）+ `src/embed.js` + `tests/unit/failureLog.test.js`（12 用例） | `ok: false` 对话写入 localStorage 最近 20 条，含 `timestamp / userInput / reason / answer / steps / rawTexts`；storage 抛错静默降级；适配器模式让 Node 单测可用内存 Map |
| **P0-3** | CI 流水线 | `.github/workflows/ci.yml` + `eslint.config.js` + `vitest.config.js` + `package.json` | 5 步自动跑：`npm ci` → `lint --max-warnings=0` → `audit --audit-level=high` → `vitest` → `coverage`；覆盖率产物 artifact 上传 7 天 |
| **P0-4** | README 文档化 | `README.md`（本章节） | 把最近两轮所有优化汇总到 README（避免单 CHANGELOG 文件被遗漏） |

### 🔧 上轮：六主题重构 + 多项修复

**① 上下文长度预算** · `src/contextBudget.js`（新增）+ `src/agentLoop.js` + `src/tools.js`

1B 级模型 context window 4K~8K token，system prompt + 历史 + Observation 叠加易爆。本模块统一裁剪策略，**截断只影响送入模型的文本，不影响 UI 展示**：

| 通道 | 上限 | 函数 |
|---|---|---|
| 长期记忆（注入 system） | 800 字符 | `budgetMemoryContext` |
| 单条 Observation（注入下一轮） | 1500 字符 | `budgetObservation` |
| 单条历史消息 | 500 字符 | `budgetHistory` |
| web_search query | 100 字符 | `SEARCH_QUERY_BUDGET` |
| save_memory key / value | 50 / 500 字符 | `validateMemoryEntry` |

**② ReAct 循环 AbortController 中止能力** · `src/agentLoop.js` + `src/embed.js` + `src/main.js`

- `runAgent({ ..., signal })` 接受 AbortSignal；主循环、模型生成、`ai.generateText` 三层透传
- 返回结果增加结构化状态 `{ ok: boolean, reason: 'success'|'aborted'|'loop'|'max_steps'|'error' }`
- UI "发送"按钮变可点击"停止"按钮，再次点击 `abort()`
- **关键修复**：只有 `ok !== false` 才把回答落库到 IndexedDB 持久化历史（避免"我尝试了多次但未完成"污染后续上下文）

**③ IndexedDB 上限 + 索引游标查询** · `src/memory.js`

- 新增 `MAX_STORAGE_MESSAGES = 200`，`addMessage` 后异步 `trimHistory` 自动裁剪
- `getRecent` 优先走索引游标倒序取 N 条（O(log n)），回退全量加载
- 内存适配器同步实现 `getRecentFromIndex`（Node 单测等价语义）

**④ 工具系统重构 + 全角字符支持** · `src/tools.js`

- 工具注册表从 switch/case 改为 `TOOLS = { name: { description, parameters, handler } }`，新增工具只需加一个对象
- `safeEvaluate` tokenizer 入口全角→半角规整（支持 `１２＋３４`、`（２＋３）＊４`）
- `web_search` query 走 100 字符截断
- `save_memory` 加 key/value 长度校验
- `runTool` 统一调度 + try/catch，**任何异常都转字符串而不是抛 JS 异常**
- `TOOL_SCHEMAS` 从 TOOLS 派生（向后兼容）

**⑤ 页面实时监听多实例安全 + replaceState 漏修** · `src/pageReader.js`

- **P0 修复**：底层 observer 单例化 + 引用计数管理（避免一个实例 dispose 误伤其他实例）
- 补 patch `history.replaceState`（之前只 patch 了 pushState，SPA 路由切换会漏触发）
- `rawLength` 字段记录原始长度，准确判断 `truncated`
- 截断从调用方移到 `refreshCache`（缓存一致性）

**⑥ dev-proxy 安全 + 鲁棒性** · `server/dev-proxy.mjs` + `tests/unit/devProxy.test.js`（6 用例）

- **P0-1 修复**：`buildUpstreamUrl` 的 `decodeURIComponent` 包 try/catch，非法编码 → 返回 null → 404，不崩进程
- `buildUpstreamUrl` 改为 export（便于单测）
- 新增 `PROXY_TOKEN` 环境变量校验：未设置 = 本地开发放行；设置后必须 `X-Proxy-Token` 头或 `?token=` 参数
- 启动服务器加 `isMainModule` 守卫（import 时跳过，单元测试可安全 import）

**附加修复**

| 文件 | 修复 |
|---|---|
| `src/embed.js` | 生产环境 `verifyProxy` 默认值 `true → false`（托管平台 rewrites 无法附加 `X-Proxy-Worker` 头） |
| `src/modelLoader.js` | `busy = false` 成功路径显式复位（之前依赖 SDK `modelloaded` 事件时序） |
| `src/main.js` | 大重构：原本 main.js 直接持有 `BrowserAI` / `MemoryStore` / `ModelLoader` / `runAgent` 4 个对象（与 embed.js 重复状态机），现在只负责 DOM 渲染与事件绑定 |
| `tests/unit/agentLoop.test.js` | 新增 5 个测试：历史注入、模型异常 ok 标记、换工具引导、recall 无结果换工具、连续重复检测 |
| `README.md` | 删除冗余"试试这些"块；加 Netlify 限制说明；加公网部署 PROXY_TOKEN 安全说明；模型下拉 5 → 3 个；加 Qwen3.5-2B 待实测警告 |

### 📊 改动规模

```
 README.md                     |   28 +-
 dist-embed/local-agent.esm.js | 2265 +++++++++++++++------ (已从索引移除)
 package-lock.json             |  306 +++---
 package.json                  |    8 +
 server/dev-proxy.mjs          |   43 +-
 src/agentLoop.js              |   29 +-
 src/embed.js                  |   42 +-
 src/failureLog.js             |  120 ++ (新增)
 src/main.js                   |  109 +-
 src/memory.js                 |   53 +-
 src/modelLoader.js            |    3 +-
 src/pageReader.js             |  104 +-
 src/tools.js                  |  179 ++--
 tests/unit/agentLoop.test.js  |   15 +
 tests/unit/devProxy.test.js   |   51 ++ (新增)
 tests/unit/failureLog.test.js |  120 ++ (新增)
 tests/unit/tools.test.js      |    7 +-
 .gitignore                    |   18 +-
 eslint.config.js              |   80 ++ (新增)
 vitest.config.js              |   18 ++ (新增)
 .github/workflows/ci.yml      |   50 ++ (新增)
```

### 🔭 后续方向（按优先级）

- **P0 后续**：CI 跑起来后第一次 lint 报错修复（人工 review 后已选温和规则集，但 `no-unused-vars` 可能仍报）
- **P1（一个月内）**：ReAct 解析器从正则改为 PEG.js 解析器生成；工具 schema 从文本改为 JSON Schema；工具调用计时统计；AbortController 透传到工具层
- **P2（季度内）**：记忆系统改为 embedding 语义检索；Service Worker 离线缓存模型权重；Web Worker 隔离主线程推理；MCP / A2A 协议暴露
- **长远**：脱离 `@missionsquad/browserai` wrapper 直接接下层 SDK；从"网页内聊天 demo"转向"本地 AI 助手 PWA"；建立端到端性能预算和观测基线
