# 本地智能体 · Local Agent

一个**完全在浏览器中运行**的本地小模型智能体：基于 [@missionsquad/browserai](https://github.com/MissionSquad/BrowserAI)
（WebGPU / WebLLM）加载 1B 级开源模型，实现 **ReAct（思考-行动-观察）循环**、**工具系统**
（时间 / 计算 / 搜索 / 页面读取 / 记忆）与 **IndexedDB 持久化记忆**，并提供流式输出的聊天界面。

对话不上传服务器；模型权重下载一次后由浏览器缓存，之后离线可用（权重存放于浏览器 Cache / IndexedDB）。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| **`README.md`** | 本文件：功能、架构、快速开始、模型、部署、限制 |
| **`USAGE.md`** | 使用流程：本地体验 / 嵌入 / 部署 / 命令速查 / 常见问题 |
| **`INTEGRATION.md`** | 嵌入已有页面的三种方式、宿主须知与完整 API |

## 功能总览（对应验收标准）

| 阶段 | 功能 | 验收点 |
| --- | --- | --- |
| Phase 1 | 环境与基础骨架 | 打开页面可见加载按钮，控制台无报错 |
| Phase 2 | 模型加载引擎（`src/modelLoader.js`） | 进度条 0% → 100%，控制台输出「模型已就绪」 |
| Phase 3 | ReAct 核心循环（`src/agentLoop.js`） | 输入“现在几点”，智能体调用时间工具并回复 |
| Phase 4 | 工具系统 + 记忆（`src/tools.js` / `src/memory.js`） | 记住上一轮对话；两位数加减乘除 |
| Phase 5 | UI 美化 + 流式输出 + 部署 | 界面美观、交互流畅，可部署 Vercel/Netlify |

## 快速开始

环境要求：Node.js 20+；浏览器需支持 **WebGPU**（Chrome / Edge 最新版，建议独显）。

```bash
# 1. 安装依赖
npm install

# 2. 启动模型下载代理（终端 1）
npm run proxy
#    [dev-proxy] listening on http://localhost:8787

# 3. 启动开发服务器（终端 2）
npm run dev
#    打开 http://127.0.0.1:5189
```

> 为什么需要代理？模型权重托管在 HuggingFace，国内网络无法直连。`dev-proxy` 把 SDK 的模型下载请求
> （`/hf/*`、`/hf-transformers/*`、`/gh-raw/*`）转发到国内可访问的 **hf-mirror.com / hf-api.cn** 与
> **jsdelivr 镜像**（多上游自动回退），页面保持同源、无需 CORS 配置。

页面操作：点击「加载模型」→ 首次下载推荐档权重（默认 Qwen3.5 2B 约 1.2GB，可下拉切换 0.8B 约 447MB /
4B 约 2.4GB），之后走浏览器缓存秒开 → 控制台输出 `✅ 模型已就绪`、进度条 100% → 开始对话。

## 嵌入已有页面

核心逻辑与 UI 完全解耦，可把智能体作为组件嵌入任意已有 Web 页面（聊天浮窗、客服助手等）：

```js
import { createLocalAgent } from "./src/embed.js";

const agent = createLocalAgent({ onProgress: renderBar, onReady: enableChat, onError: showError });
await agent.ready();
await agent.load();                                                   // 加载推荐档（Qwen3.5 2B，约 1.2GB）
const { answer } = await agent.chat("现在几点", { onStep, onDelta });  // 对话 + 流式
```

三种接入方式（npm 源码复用 / 单文件产物 `<script>` / iframe）、宿主注意事项与完整 API 见
**`INTEGRATION.md`**。可运行的示例有 `demo/embed-demo.html`（模拟已有网站右下角聊天浮窗）与
`search.html`（仿百度搜索页，悬浮球 + 聊天弹窗），使用说明见 **`USAGE.md`**。

## 架构

```
index.html ──┐
src/main.js  ── UI 组装：事件绑定、流式渲染、进度条
├─ src/embed.js          嵌入式 API 唯一入口（createLocalAgent：ready / load / chat / dispose…）
├─ src/modelLoader.js    模型加载引擎（WebGPU 探测、loadprogress 订阅、就绪事件、档位推荐与降级）
├─ src/agentLoop.js      ReAct 循环：生成 → 解析(Thought/Action/Input) → 执行工具 → Observation → 循环/结束
│    └─ 高容错解析器：标准块 / JSON 工具调用 / 内联调用 / <tool_call> / 全角符号 / 死循环保护
├─ src/tools.js          工具注册表：get_current_time / calculate / web_search / read_page_content / save_memory / recall_memory
├─ src/toolSchemas.js    由 TOOLS 派生的 JSON Schema 与 OpenAI tools 格式（单一数据源）
├─ src/contextBudget.js  上下文预算：Observation / 历史 / 记忆裁剪，记忆条目校验与防注入标注
├─ src/failureLog.js     失败对话调试日志（localStorage 最近 20 条，写入失败静默降级）
├─ src/pageReader.js     页面实时内容读取：正文提取 + 智能截断 + MutationObserver 缓存 + SPA 路由监听
├─ src/memory.js         IndexedDB：对话历史（跨轮记忆）+ 长期事实记忆
├─ src/swStrategies.js   Service Worker 缓存策略（与 public/sw.js 同步维护，单测保证行为一致）
└─ src/style.css         深色渐变聊天 UI、打字机流式输出、思考过程折叠块

server/dev-proxy.mjs      本地模型代理：/hf* → hf 镜像、/gh-raw* → jsdelivr 镜像（多上游回退、健康检查、PROXY_TOKEN）
public/sw.js              离线缓存 Service Worker（与 src/swStrategies.js 同步）
```

## 测试

单元测试（vitest）覆盖解析器、计算器、工具、记忆、页面读取、上下文预算、失败日志、dev-proxy、模型自适应、
SW 缓存策略、JSON Schema、嵌入式 API；E2E（Playwright + 系统 Chrome + WebGPU）覆盖全部阶段验收点：
进度条 0→100%、控制台「模型已就绪」、时间工具、两位数乘法（12×34=408）、跨轮记忆（“我叫小明”→“我叫什么名字”）、
长期记忆工具、界面元素、控制台零报错。

完整命令与前置条件见 `USAGE.md` 的「常用命令」。

## 部署（Vercel / Netlify）

生产环境无需本地代理：平台的 **rewrites / redirects** 会把同源 `/hf/*`、`/hf-transformers/*`、`/gh-raw/*`
请求透明转发到 hf 镜像 / jsdelivr（详见 `vercel.json` / `netlify.toml`）。构建产物：`npm run build` → `dist/`。

- **Vercel**：导入仓库即可，自动识别 `vercel.json`（构建命令与外部 URL rewrites 已配置）。
- **Netlify**：导入仓库，构建命令 `npm run build`、发布目录 `dist`，自动识别 `netlify.toml`。
  > Netlify 的 redirects 无法完成 `gh-raw/{owner}/{repo}/{branch}/{path}` → jsdelivr 的路径重排，
  > 目前仅配置了 `mlc-ai/binary-mlc-llm-libs@main` 一条固定规则。若更换模型或 SDK 升级需要从
  > 其他 GitHub 仓库拉取文件，Netlify 部署会 404——此时请改用 Vercel 或自建 Cloudflare Worker 代理。

页面在生产环境自动检测为非 localhost，会以 `verifyProxy: false` 运行（平台转发无法附加 `X-Proxy-Worker` 头）。
也可把 `server/dev-proxy.mjs` 部署为 Cloudflare Worker 以获得完整健康检查能力（参见 BrowserAI 仓库的 `worker-template/`）。

> **公网部署安全**：把 `dev-proxy.mjs` 部署为公网可访问的服务前，务必设置 `PROXY_TOKEN` 环境变量开启访问
> 令牌校验（请求需携带 `X-Proxy-Token` 头或 `?token=` 参数），否则代理会沦为开放镜像中转站，带来流量成本
> 与合规风险。此外模型权重来自 hf-mirror 等第三方镜像，属供应链信任范畴，请知悉。

## 离线缓存（Service Worker）

`createLocalAgent()` 在 `ready()` 内部会自动注册 `public/sw.js`（best-effort，失败仅 `console.warn`，不阻断主流程）。
注册成功后：

| 资源类型 | 缓存策略 | 缓存名 | 原因 |
| --- | --- | --- | --- |
| 模型权重 `/hf/*` `/hf-transformers/*` `/gh-raw/*` | cache-first | `local-agent-models-v2` | 权重不变，命中即用 |
| 应用 chunks `/assets/*` `/dist-embed/*` `local-agent.esm.js` | stale-while-revalidate | `local-agent-app-v2` | vite hash 文件名更新时自动切到新版 |
| 导航请求（HTML） | network-first + cache fallback | `local-agent-app-v2` | 避免 stale SW 卡住；离线时降级到 `/index.html` |
| 跨域请求 | 不拦截 | — | 让浏览器原生处理 |

**效果**：首次加载完成后，断网 / 跨页面仍能秒开；模型权重缓存在用户磁盘上，IndexedDB 臃肿问题得到缓解。

**清除缓存**：DevTools → Application → Storage → Clear site data；或宿主调用 `caches.delete("local-agent-models-v2")`。
升级缓存策略时 `public/sw.js` 会递增 `VERSION`，activate 阶段自动清理旧缓存。

**生产环境要求**：HTTPS（localhost 除外）。iframe 嵌入场景 SW 注册可能被宿主页面限制，详见 `INTEGRATION.md`。

## 模型选择与设备自适应

页面左侧下拉可选 **3 个模型档位**（均为国内开源，仅阿里 Qwen3.5 系列）。默认 `modelId: "auto"`——`ready()`
会探测硬件（WebGPU + 处理器核心数）并推荐档位，下拉自动切到推荐项并在标题显示原因，也可手动覆盖。

| 模型 ID | 档位 | 下载 / 显存 | 适用设备 | 推荐 |
| --- | --- | --- | --- | --- |
| `Qwen3.5-0.8B-q4f16_1-MLC` | low | ~447MB / 1.6GB | 低端 / 无 GPU 加速 / 最低显存兜底 | — |
| `Qwen3.5-2B-q4f16_1-MLC` | **high** | ~1.2GB / 2.2GB | 主流 PC（4+ 核） | 自动推荐 |
| `Qwen3.5-4B-q4f16_1-MLC` | ultra | ~2.4GB / 6GB | 高端 PC（8+ 核） | — |

自适应逻辑（`src/modelLoader.js` 的 `recommendModelId(snapshot)`）：

- 不支持 WebGPU → 最低档（low）
- 2 核以下 → low
- 4 核及以上 → 候选 ultra → high → low，优先带 `recommended` 标记的档（Qwen3.5 2B）
- 推荐档位于 high 档；8 核机器若想直接上 ultra，可把 `Qwen3.5-4B` 也标 `recommended: true`

**手动覆盖**：`createLocalAgent({ modelId: "Qwen3.5-4B-q4f16_1-MLC" })`。

所有档位均不依赖 huggingface.co 直连（经 dev-proxy 转发国内镜像下载）；`MODEL_OPTIONS` 的每个 id 都经过 SDK
目录校验（单元测试强制断言），页面下拉与 `load()` 均按实际目录过滤/降级，杜绝“选中即 UnknownModelError”的失效选项。

**新模型接入前请确认**：

1. MLC 后端有对应编译权重（id 必须有 `q4f16_1-MLC` 等量化后缀）
2. 是国内开源（避免 huggingface.co 直连）
3. 在 `MODEL_OPTIONS` 里补全元数据（tier / sizeMB / minVRAMGB / minCores / description）
4. 首次使用在本地实测可加载；若失败先从 `MODEL_OPTIONS` 移除该选项
5. 跑单元测试——「MODEL_OPTIONS ⊆ SDK 真实目录（MODEL_PRESETS）」与「全为国内开源」的断言会立即拦截失效 id

## 性能与可观测性

**工具调用计时**：每次 `agent.chat()` 后，UI 显示每个工具的耗时与成功/失败标记（小灰字 “工具结果 · 12.5ms ✓”），
控制台打印首 token 延迟与总耗时 / 工具调用次数。

**性能统计 API**：`agent.getStats()` 返回最近 20 次 chat 的累计快照。

| 字段 | 含义 |
| --- | --- |
| `sampleCount` | 已采样次数 |
| `history[]` | 每次 chat 的明细：`timestamp` / `ok` / `reason` / `totalDurationMs` / `toolCallCount` / `toolFailures` / `toolTotalMs` / `ttftMs` / `ttftReason` / `stepCount` |
| `avgTotalMs` / `avgToolMsPerChat` / `avgToolMsPerCall` | 平均总耗时 / 平均每次对话的工具耗时 / 平均每次工具调用耗时 |
| `totalToolCalls` / `totalToolFailures` | 累计工具调用数与失败数 |

失败的对话不会写入 IndexedDB 历史（避免污染后续上下文），而是记入失败日志（最近 20 条，含 reason / steps /
rawTexts），宿主可用 `agent.getFailureLog()` 读取、`clearFailureLog()` 清空。

**JSON Schema 工具定义**：每个工具的 `parametersSchema` 在 `src/tools.js` 的 TOOLS 注册表中维护（单一数据源），
由 `src/toolSchemas.js` 派生：

| API | 作用 |
| --- | --- |
| `getToolJsonSchema(name)` | 单个工具的 JSON Schema（含 `required` 与 `additionalProperties: false`） |
| `getToolJsonSchemas()` | 全部工具的 Schema 列表 |
| `getOpenAIToolsFormat()` | OpenAI tools 风格数组，可直接对接原生 function calling |
| `validateToolInput(name, input)` | 结构校验，返回 `{ ok: true }` 或错误信息；业务合法性由 handler 自己保证 |

接入 SDK 原生 tool calling 时（WebLLM / OpenAI 客户端 SDK 直接传 `getOpenAIToolsFormat()`），模型按 JSON 格式
返回，绕过 ReAct 文本解析，可显著降低“答非所问”率。

## 目录结构

```
├── index.html / search.html / vite.config.js / package.json
├── src/            # 应用源码（12 个文件，见上方架构）
├── server/         # 本地模型代理服务器（dev-proxy.mjs）
├── public/         # 离线缓存 Service Worker（sw.js）
├── demo/           # 嵌入示例（embed-demo.html）
├── tests/          # 单元测试（tests/unit）+ E2E 验收脚本
├── vercel.json     # Vercel 部署配置（rewrites → 镜像）
└── netlify.toml    # Netlify 部署配置（redirects → 镜像）
```

## 已知限制

- **硬件**：文本模型需要 WebGPU；无独显时可能回退软件渲染，速度较慢。
- **模型能力**：小模型对工具调用的格式遵循存在不确定性，解析器已做多格式容错 + 死循环保护，但仍偶有答非所问；
  换更大的模型（2B/4B）可明显提升稳定性。当前只能胜任时间、计算、搜索这类简单任务。
- **搜索工具**：依赖 DuckDuckGo / 维基百科的公网可达性，失败时自动降级并返回说明。
- **页面读取**：`read_page_content` 不指定选择器时会读取整个页面，正文提取可能带入无关内容。
- **存储**：对话历史默认存 IndexedDB，浏览器可用空间小，长期堆积会使浏览器臃肿、影响性能；若改存后端数据库，
  需额外配置数据库连接，且失去离线能力。
- **嵌入范围**：仅支持单页面应用（SPA）。多页面应用（MPA）中不能依赖“内存”与“页面生命周期”，
  应把智能体当作由 IndexedDB 存数据、Service Worker 存模型的独立本地服务，而不是挂在页面 DOM 上的临时脚本。
