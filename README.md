# 本地智能体 · Local Agent

一个**完全在浏览器中运行**的本地小模型智能体：基于 [@missionsquad/browserai](https://github.com/MissionSquad/BrowserAI)
（WebGPU / WebLLM）加载 0.8B–4B 级开源模型，实现**工具调用循环**（ReAct 文本 / Qwen 原生 XML / 约束解码三种协议可选）、
**工具系统**（时间 / 计算 / 搜索 / 页面读取 / 记忆）与 **IndexedDB 持久化记忆**，并提供流式输出的聊天界面。

对话不上传服务器；模型权重下载一次后由浏览器缓存（SDK 的 IndexedDB，**单一副本**），之后离线可用。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| **`README.md`** | 本文件：功能、架构、快速开始、模型、部署、限制 |
| **`USAGE.md`** | 使用流程：本地体验 / 嵌入 / 部署 / 命令速查 / 常见问题 |
| **`INTEGRATION.md`** | 嵌入已有页面的三种方式、宿主须知与完整 API |
| **`ROADMAP.md`** | 迭代计划：分批任务、验收标准、决策记录与风险登记 |
| **`REVIEW.md`** | 2026-09 迭代评审：市场情况、代码级发现、分批次建议与待验证清单 |
| **`research/`** | 上述评审的调研底稿（浏览器运行时格局 / 本地 AI 市场），含未核验条目清单 |

## 功能总览（对应验收标准）

| 阶段 | 功能 | 验收点 |
| --- | --- | --- |
| Phase 1 | 环境与基础骨架 | 打开页面可见加载按钮，控制台无报错 |
| Phase 2 | 模型加载引擎（`src/modelLoader.js`） | 进度条 0% → 100%，控制台输出「模型已就绪」 |
| Phase 3 | ReAct 核心循环（`src/agentLoop.js`） | 输入“现在几点”，智能体调用时间工具并回复 |
| Phase 4 | 工具系统 + 记忆（`src/tools.js` / `src/memory.js`） | 记住上一轮对话；两位数加减乘除 |
| Phase 5 | UI 美化 + 流式输出 + 部署 | 界面美观、交互流畅，可部署 Vercel/Netlify |

## 快速开始

环境要求：Node.js **≥ 20.19**（或 ≥ 22.12，Vite 7 的要求）；浏览器需支持 **WebGPU**（Chrome / Edge 最新版，建议独显）。

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

页面操作：点击「加载模型」→ 首次下载**下拉中所选档**的权重（0.8B 约 447MB / 2B 约 1.2GB / 4B 约 2.4GB），
之后走浏览器缓存秒开 → 控制台输出 `✅ 模型已就绪`、进度条 100% → 开始对话。

> **设备自适应已接线**：下拉初始值是最低档占位，`ready()` 探测硬件后通过 `model-recommended` 事件把推荐档
> 写回下拉（`src/main.js` 的 `handleModelEvent`），所以点「加载模型」用的就是推荐档。想用更高档位请在点击前
> 手动选择；`search.html`（调 `agent.load()` 走推荐档）与 `demo/embed-demo.html`（同样消费该事件）行为一致。
> 推荐逻辑与档位映射见下文「模型选择与设备自适应」。

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
src/main.js  ── 应用入口：模型面板 + 加载事件组装（聊天 UI 交给 chatWidget）
├─ src/embed.js          嵌入式 API 唯一入口（createLocalAgent：ready / load / chat / dispose…）
├─ src/chatWidget.js     统一聊天组件（index / search / demo 三页共用）＋同目录 chatWidget.css（--la-* 变量可换肤）
├─ src/modelLoader.js    模型加载引擎（WebGPU 探测、loadprogress 订阅、就绪事件、档位推荐与降级）
├─ src/agentLoop.js      工具调用循环：生成 → 解析 → 执行工具 → 结果回传 → 循环/结束
│    └─ 三种协议（react / native / json）+ 高容错解析器：标准块 / JSON / 内联 / <tool_call> / 全角符号 / 死循环保护
├─ src/tools.js          工具注册表：get_current_time / calculate / web_search / read_page_content / save_memory / recall_memory
├─ src/toolSchemas.js    由 TOOLS 派生的 JSON Schema 与 OpenAI tools 格式（单一数据源）
├─ src/contextBudget.js  上下文预算：Observation / 历史 / 记忆裁剪，记忆条目校验与防注入标注
├─ src/failureLog.js     失败对话调试日志（localStorage 最近 20 条，写入失败静默降级）
├─ src/pageReader.js     页面实时内容读取：正文提取 + 智能截断 + MutationObserver 缓存 + SPA 路由监听
├─ src/memory.js         IndexedDB：对话历史（跨轮记忆）+ 长期事实记忆
├─ src/swStrategies.js   Service Worker 缓存策略（与 public/sw.js 同步维护，单测保证行为一致）
└─ src/style.css         主页面布局与模型面板样式（聊天气泡/打字机/思考过程样式在 chatWidget.css）

server/dev-proxy.mjs      本地模型代理：/hf* → hf 镜像、/gh-raw* → jsdelivr 镜像（多上游回退、健康检查、PROXY_TOKEN）
public/sw.js              离线缓存 Service Worker（与 src/swStrategies.js 同步）
```

## 测试

单元测试（vitest，`tests/unit/` 共 21 个文件）覆盖解析器与三协议、工具与计算器、记忆（含裁剪串行化）、
页面读取（含 bootstrap 时序）、上下文预算、失败日志、聊天组件、dev-proxy（含多上游 fallback）、模型自适应、
SW 缓存策略（含与 `public/sw.js` 的同步守卫）、JSON Schema、嵌入式 API；
E2E（Playwright + 系统 Chrome + WebGPU）覆盖全部阶段验收点：进度条 0→100%、控制台「模型已就绪」、时间工具、
两位数乘法（12×34=408）、跨轮记忆（“我叫小明”→“我叫什么名字”）、长期记忆工具、界面元素、控制台零报错。

完整命令与前置条件见 `USAGE.md` 的「常用命令」。

## 部署（Vercel / Netlify）

生产环境无需本地代理：平台的 **rewrites / redirects** 会把同源 `/hf/*`、`/hf-transformers/*`、`/gh-raw/*`
请求透明转发到 hf 镜像 / jsdelivr（详见 `vercel.json` / `netlify.toml`）。构建产物：`npm run build` → `dist/`。

- **Vercel**：导入仓库即可，自动识别 `vercel.json`（构建命令与外部 URL rewrites 已配置）。
- **Netlify**：导入仓库，构建命令 `npm run build`、发布目录 `dist`，自动识别 `netlify.toml`。
  > Netlify 的 redirects 支持命名占位符，`netlify.toml` 已用
  > `/gh-raw/:owner/:repo/:branch/*` → `https://cdn.jsdelivr.net/gh/:owner/:repo@:branch/:splat`
  > 完成路径重排（注意 jsdelivr 要求 `repo@branch` 形式，缺 `@` 会 404）。与 Vercel 的差别只在
  > **单上游**：Netlify 平台侧无法做多镜像 fallback，若 hf-mirror.com 抖动，生产环境需自建
  > Cloudflare Worker（见下）才能自动切换上游。

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
| 模型权重 `/hf/*` `/hf-transformers/*` `/gh-raw/*` | **不拦截** | — | 缓存唯一交给 SDK 的 IndexedDB，避免同一份权重存两份（见下） |
| 应用 chunks `/assets/*` `/dist-embed/*` `local-agent.esm.js` | stale-while-revalidate | `local-agent-app-v3` | vite hash 文件名更新时自动切到新版 |
| 导航请求（HTML） | network-first + cache fallback | `local-agent-app-v3` | 避免 stale SW 卡住；离线时降级到 `/index.html` |
| 跨域请求 | 不拦截 | — | 让浏览器原生处理 |

**效果**：应用壳（HTML / CSS / JS chunks）断网、跨页面仍能秒开。

> **为什么模型权重不由 SW 缓存**：SDK 自身按 `cacheBackend`（本项目用 `indexeddb`）把权重缓存到
> `webllm/model` / `webllm/config` / `webllm/wasm`，且**缓存命中后不再发起 fetch**——SW 若再做一层
> cache-first，那份副本永远不会被读取，只会让磁盘占用翻倍（2B 档 ~1.2GB → 多占 ~1.2GB），并让
> `deleteModelArtifacts()` 的"清理"承诺失真。自 `sw.js` 的 `v3` 起模型路径不再被拦截：模型缓存唯一在
> SDK 侧，离线可用性不变（权重仍在 IndexedDB 里）。升级到 v3 时 activate 阶段会一并删除历史遗留的
> `local-agent-models-*` 缓存——那份副本本来就是死数据，因此**不会触发任何重新下载**。

**清除缓存**：

- SDK 侧：`agent.deleteModelArtifacts()`（不传参清空全部模型产物），或 DevTools → Application → IndexedDB；
- SW 侧只缓存应用壳；DevTools → Application → Storage → Clear site data 可整体重置。
升级缓存策略时 `public/sw.js` 会递增 `VERSION`，activate 阶段自动清理旧缓存。

**存储管理 API**（宿主可自行接 UI，例如"模型占用 1.2GB · 清理"按钮）：`agent.getStorageEstimate()`
查询源站占用 / 配额估算，`agent.getCacheStatus(modelId?)` 查询某档缓存状态，
`agent.deleteModelArtifacts(modelId?)` 删除模型缓存（不传参则清空全部；只动模型产物，不影响 IndexedDB 对话历史）。

> 注意：`getStorageEstimate()` 返回的是**整个源站**的占用（含应用壳缓存与对话历史），而
> `deleteModelArtifacts()` 只清理模型产物。由于模型缓存现在唯一存在于 SDK 侧，清理后占用会真实下降
> （从旧版本升级上来的用户，SW 里历史遗留的那份模型副本会在 SW activate 时被自动删除）。

**生产环境要求**：HTTPS（localhost 除外）。iframe 嵌入场景 SW 注册可能被宿主页面限制，详见 `INTEGRATION.md`。

## 工具调用协议

`createLocalAgent({ toolProtocol })` 决定智能体如何与模型交换工具调用，共四种取值：

| 取值 | 行为 |
| --- | --- |
| `"auto"`（默认） | Qwen 系模型使用其 chat template **原生协议**（system 内的 `<tools>` JSON 定义 + `<tool_call>` XML 回复 + `<tool_response>` 结果回传）；其他模型沿用 ReAct 文本协议 |
| `"react"` | 强制 `Thought:` / `Action:` / `Action Input:` + `Observation:` 文本协议（纯文本协议路径，可作为回退选项） |
| `"native"` | 强制原生 XML 工具协议（调试 Qwen 协议时使用） |
| `"json"` | **约束解码**：把 `buildDecisionSchema()` 作为 `schema` 交给 WebLLM 做 grammar 约束，模型只可能输出符合 schema 的 JSON——`action` 被 `enum` 锁死为「已注册工具名 + 空串」，从根本上消除未知工具名与格式跑偏；由 `parseStructuredDecision()` 解析。代价：流式输出内容是 JSON 文本 |

> `"json"` 模式的 schema 定义在 `src/toolSchemas.js`（不使用 `oneOf` / `$ref`，只依赖 WebLLM grammar 支持的 `type` / `enum` / `maxLength` 基础子集）；`input` 用 JSON 字符串承载，避免「任意对象」给约束构造带来的复杂度。
>
> 三条解析路径相互独立：`react` / `native` 各自成路（既有单测断言的 `Observation:` 前缀只在 `react` 下产生），`json` 仅在显式指定时启用。

## 模型选择与设备自适应

页面左侧下拉可选 **3 个模型档位**（均为国内开源，仅阿里 Qwen3.5 系列）。默认 `modelId: "auto"`——`ready()`
会探测硬件（WebGPU / 处理器核心数 / 设备内存）并算出推荐档位，通过 `onEvent` 的 `model-recommended` 事件
写回下拉（主页面与 `demo/embed-demo.html` 均已接线），也可手动覆盖。

| 模型 ID | 档位 | 下载 / 显存 | 适用设备 | 自动推荐条件 |
| --- | --- | --- | --- | --- |
| `Qwen3.5-0.8B-q4f16_1-MLC` | low | ~447MB / 1.6GB | 低端 / 最低显存兜底（**工具调用能力有限**，见下） | 兜底档（任何设备可用） |
| `Qwen3.5-2B-q4f16_1-MLC` | **high** | ~1.2GB / 2.2GB | 主流 PC | 4 核以上 |
| `Qwen3.5-4B-q4f16_1-MLC` | ultra | ~2.4GB / **3.8GB** | 高端 PC | 12 核以上且显存预算充足 |

> 显存数值取自 SDK 的 `MODEL_PRESETS.vramRequiredMB`（0.8B 1629 / 2B 2245 / 4B 3868 MB，q4f16_1）；
> `MODEL_OPTIONS` 按"向上取整到 0.1GB"记为 1.6 / 2.2 / 3.8GB，并由单测锁定与 SDK 权威值的一致性。
>
> **0.8B 档的能力边界（官方自测数据）**：BFCL-V4 工具调用 25.3 分（2B 为 43.6），多轮 agent 任务
> TAU2-Bench 11.6 分（2B 为 48.8）。也就是说 **0.8B 适合纯对话/抽取，不适合承担工具调用**——
> 若在你的设备上 agent 表现明显变差，先确认当前档位而不是怀疑循环实现。

自适应逻辑（`src/modelLoader.js` 的 `recommendModelId(snapshot)`）——逐档过滤后取**最高**档：

1. 不支持 WebGPU → 最低档；
2. 候选档需同时满足：`核数 ≥ minCores`（能跑得起来）、`核数 ≥ recommendMinCores`（值得自动推荐）、
   显存预算 ≥ `minVRAMGB`；
3. 显存预算 = `snapshot.deviceMemoryGB × 0.6`（该字段只有 Chromium 系提供，且被 clamp 到 8GB；
   Firefox / Safari 无此信号时跳过该约束）；
4. 全部不满足 → 最低档兜底。

> **为什么 4B 要 12 核以上才自动推荐**：`navigator.deviceMemory` 被 clamp 到 8GB，因此 8 核 16GB 与
> 16 核 32GB 的内存信号**完全相同**，区分二者只能靠核数。4B 的"能跑"门槛（`minCores`）仍是 8 核，
> 8 核机器可手动选择；自动推荐收紧到 12 核，避免轻薄本被推 2.4GB 下载后跑不动。
> 想调整这个取舍，直接改 `MODEL_OPTIONS` 里的 `recommendMinCores` 即可。

**手动覆盖**：`createLocalAgent({ modelId: "Qwen3.5-4B-q4f16_1-MLC" })`。

所有档位均不依赖 huggingface.co 直连（经 dev-proxy 转发国内镜像下载）；`MODEL_OPTIONS` 的每个 id 都经过 SDK
目录校验（单元测试强制断言）。`load()` 会把目录外的 id 降级到最低可用档并 `console.warn`；
`agent.getAvailableModels()` 会按 SDK 真实目录过滤（宿主 UI 应使用它渲染下拉——主页面 `src/main.js` 目前仍用
未过滤的 `getModelOptions()`，因当前 3 个档位都在目录内故不会出错，见 `REVIEW.md` 的 A7）。

**新模型接入前请确认**：

1. MLC 后端有对应编译权重（id 必须有 `q4f16_1-MLC` 等量化后缀）
2. **该档位在 SDK 的 `MODEL_PRESETS` 目录里**——不在目录内的 id 会被 `getAvailableModelOptions()` 过滤掉，
   仅靠"补 `MODEL_OPTIONS` 元数据"不会让它出现（如 `Qwen3.5-9B` 就属于这种，需要走自定义 ModelRecord 路线）
3. 是国内开源（避免 huggingface.co 直连，或改用代理可达的镜像源）
4. 在 `MODEL_OPTIONS` 里补全元数据（tier / sizeMB / minVRAMGB / minCores / description），显存值优先采用
   SDK 的 `vramRequiredMB` 而不是估算
5. 跑单元测试——「MODEL_OPTIONS ⊆ SDK 真实目录（MODEL_PRESETS）」与「全为国内开源」的断言会立即拦截失效 id
6. **额外跑一遍解析器兼容性**：用该模型的实际输出喂给 `parseReActOutput()` / `parseToolCallXml()`，
   确认工具调用能被正确识别，必要时补解析路径。同类小模型的工具调用能力差异极大（BFCLv3 口径下
   同为 ~1B 级，Gemma 3 1B IT 16.6 分、Granite 4.0-1B 52.4 分），换模型后"agent 变笨"常常是格式没被解析到

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
| `getOpenAIToolsFormat()` | OpenAI tools 风格数组；`native` 协议用它生成 `<tools>` 段 |
| `buildDecisionSchema()` | 约束解码用的「一步决策」schema：`action` 用 `enum` 锁死为已注册工具名 + 空串 |
| `validateToolInput(name, input)` | 结构校验，返回 `{ ok: true }` 或错误信息；业务合法性由 handler 自己保证 |

> SDK（及上游 WebLLM）目前**不提供**原生 `tools` / `tool_choice` 参数——WebLLM 0.2.85 仍把 function calling
> 标注为 `(WIP)`，且其 `functionCallingModelIds` 白名单只有 7B/8B 档（≤4B 一条都没有）。因此工具调用由本项目
> 的三种协议自行编排：`json` 协议通过 SDK 的 `schema` 选项触发 WebLLM 的 grammar 约束解码（底层为
> `@mlc-ai/web-xgrammar`），在效果上等同于"原生 function calling"，且不依赖上游进度。注意上游**未文档化**
> grammar 支持的 JSON Schema 子集边界，`buildDecisionSchema()` 因此只使用 `type` / `enum` / `maxLength` 等基础关键字。

## 目录结构

```
├── index.html / search.html / vite.config.js / vite.embed.config.js / package.json
├── .nvmrc          # Node 版本（22）；package.json 的 engines 为 ^20.19.0 || >=22.12.0
├── README.md / USAGE.md / INTEGRATION.md / ROADMAP.md / REVIEW.md / LICENSE
├── src/            # 应用源码（14 个文件：12 个 JS + 2 个 CSS，见上方架构）
├── server/         # 本地模型代理服务器（dev-proxy.mjs）
├── public/         # 离线缓存 Service Worker（sw.js）
├── demo/           # 嵌入示例（embed-demo.html）
├── tests/          # 单元测试（tests/unit，21 个文件）+ E2E 验收脚本
├── tools/          # 本机运维脚本（git-push.ps1 / .cmd：自适应选路推送，用法的见其头部注释）
├── research/       # 市场与技术调研底稿（REVIEW.md 的来源，含未核验条目清单）
├── vercel.json     # Vercel 部署配置（rewrites → 镜像）
└── netlify.toml    # Netlify 部署配置（redirects → 镜像）
```

> `REVIEW.md` 是 2026-09 的迭代评审（市场情况 + 12 条代码级发现 + 分批次建议 + 待验证风险清单），
> `research/` 存放它的调研底稿。两者是**评审材料**，不是运行时代码的一部分。

## 已知限制

- **硬件**：文本 / 视觉 / 语音-LLM 档位**必须有 WebGPU**，不支持时 SDK 直接抛 `WebGPUUnavailableError`（不会回退软件渲染）；
  仅语音识别（Whisper / Moonshine / Parakeet）与 TTS 档位可回退 wasm。WebGPU 全球覆盖率 **85.72%**
  （[caniuse](https://caniuse.com/webgpu)，2026-08 StatCounter 数据）：Chrome/Edge 113+、Opera 99+、iOS Safari 26+
  已支持；**桌面 Safari 仍为部分支持（partial）、Firefox 157–159 仍默认关闭**。剩余约 14% 的流量池无法使用本项目，
  这一取舍是明确的（未排期；候选方案是 wllama 等 GGUF/wasm 后端）。
- **运行环境**：Node.js **≥ 20.19（或 ≥ 22.12）**——这是 Vite 7 的要求，低于该版本 `npm run dev` / `npm test`
  会直接报错（`node:fs/promises` 无 `constants` 导出）。`package.json` 已声明 `engines`（`^20.19.0 || >=22.12.0`）
  并附 `.nvmrc`（22），版本不符时安装阶段即会给出明确提示。
- **模型能力**：小模型对工具调用的格式遵循存在不确定性，解析器已做多格式容错 + 死循环保护，但仍偶有答非所问；
  换更大的模型（2B/4B）可明显提升稳定性。当前只能胜任时间、计算、搜索这类简单任务。
- **搜索工具**：当前用的是 DuckDuckGo **Instant Answer** 接口（返回摘要与相关主题，不是完整网页搜索，结果可能为空），
  并以维基百科兜底；两者都失败时返回说明。
- **页面读取**：`read_page_content` 不指定选择器时会读取整个页面，正文提取可能带入无关内容。
- **存储**：对话历史默认存 IndexedDB，浏览器可用空间小，长期堆积会使浏览器臃肿、影响性能；若改存后端数据库，
  需额外配置数据库连接，且失去离线能力。
- **嵌入范围**：仅支持单页面应用（SPA）。多页面应用（MPA）中不能依赖“内存”与“页面生命周期”，
  应把智能体当作由 IndexedDB 存数据、Service Worker 存模型的独立本地服务，而不是挂在页面 DOM 上的临时脚本。

## 许可证

本项目代码以 [MIT](LICENSE) 发布。模型权重来自第三方（`mlc-ai` 的 MLC 量化权重、HuggingFace 生态的 ONNX 权重等），
遵循各自上游许可证；本项目不重新分发权重，只提供下载代理与加载逻辑。
