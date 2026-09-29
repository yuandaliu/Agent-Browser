# 本地/端侧 AI 助手产品与市场格局调研（截至 2026 年 9 月）

> **调研方法说明（重要）**
> 本次调研的环境时间基准为 **2026 年 9 月**（由 GitHub API 返回的 `updated_at = 2026-09-27` 交叉验证）。
> 本会话的 `web_search` 工具**不可用**（缺少 API key，调用必然失败），因此全部结论来自 `web_fetch` **直接抓取一手页面**（官方文档、官方博客、定价页、GitHub API）。
> DuckDuckGo / Mojeek / Startpage / Google 的搜索端点均被拦截，仅 `cn.bing.com` 可返回结果但质量极差（返回词典义项等噪声）。**因此本报告的检索广度受限，凡未能抓到一手来源的条目，一律标注「未找到公开数据」，不做推测、不编造 URL。**
> 统一抓取日期：**2026-09-27**（GitHub API 数据）与 **2026-09-27**（网页抓取）。
>
> **档案性质**：本文件是 [`REVIEW.md`](../REVIEW.md)（2026-09 迭代评审）的**调研底稿**，不是项目运行文档。
> 姊妹篇为 [`browser-runtime-landscape-2026-09.md`](browser-runtime-landscape-2026-09.md)（浏览器端运行时格局）。
> 两份底稿的**分工**：本文件负责"赛道量级与商业化"，姊妹篇负责"技术底座与标准"。
> 凡本文件标注「未找到公开数据」而姊妹篇有结论的条目（最典型的是 **Chrome 内置 AI / Prompt API**），
> 以姊妹篇为准——那是我方检索通道受限，不是该事实不存在。

---

## 1. 桌面端本地模型工具

### 1.1 量级总表（GitHub API，抓取于 2026-09-27）

| 仓库 | stars | forks | pushed_at（活跃度） | 许可证 | 语言 |
|---|---|---|---|---|---|
| `ollama/ollama` | **181,786** | 18,018 | 2026-09-26 ✅ 活跃 | MIT | Go |
| `open-webui/open-webui` | **153,283** | 22,431 | 2026-09-26 ✅ 活跃 | NOASSERTION（非标准） | Python |
| `nomic-ai/gpt4all` | **77,378** | 8,284 | **2025-05-27 ⚠️ 停更约 16 个月** | MIT | C++ |
| `Mintplex-Labs/anything-llm` | **66,509** | 7,409 | 2026-09-26 ✅ 活跃 | MIT | JavaScript |
| `CherryHQ/cherry-studio` | **52,166** | 5,012 | 2026-09-27 ✅ 活跃 | AGPL-3.0 | TypeScript |
| `janhq/jan` | **44,663** | 3,058 | 2026-09-25 ✅ 活跃 | NOASSERTION | Rust |
| `mlc-ai/web-llm` | **19,195** | 1,384 | 2026-09-15 ✅ 活跃 | Apache-2.0 | TypeScript |
| `lmstudio-ai/lms`（仅 CLI） | 5,321 | 460 | 2026-09-25 ✅ 活跃 | MIT | TypeScript |
| `modelcontextprotocol/registry` | 7,286 | 1,006 | 2026-09-23 ✅ 活跃 | NOASSERTION | Go |
| `modelcontextprotocol/modelcontextprotocol` | 9,315 | 1,835 | 2026-09-24 ✅ 活跃 | NOASSERTION | TypeScript |

来源：`https://api.github.com/repos/<owner>/<repo>`（各仓库同构 URL），抓取日期 2026-09-27。

> ⚠️ **重要口径提醒**：**LM Studio 桌面应用本体是闭源商业软件**，其 GitHub 组织下只有 CLI（`lms`）、TypeScript SDK（`lmstudio-js`，1,782 star）、Python SDK（`lmstudio-python`，875 star）与文档仓库，**不能用 star 数代表 LM Studio 的用户量级**。

### 1.2 Ollama

- **定位**：本地模型运行时 + 模型库 + 云模型服务，官网首页现列 Kimi / GLM / MiniMax / DeepSeek / gpt-oss / Qwen / Gemma 等模型。来源：`https://api.github.com/repos/ollama/ollama`（description 字段），2026-09-27。
- **用户量级（厂商自述）**：**「Serving 8.9 million developers」**，并于 2026-07-09 宣布**融资 8,800 万美元**，投资方包括 Benchmark、Theory Ventures、8VC、Y Combinator 及天使投资人。来源：[Ollama: all aboard open models](https://ollama.com/blog/all-aboard-open-models)（2026-07-09）。
- **GUI**：**2025-07-30 发布官方桌面 app（macOS / Windows）**。来源：[Ollama's new app](https://ollama.com/blog/new-app)（2025-07-30）。
- **工具调用（tool calling）**：**2024-07-25 起支持 tool calling**；2025-05-28 支持**流式 + 工具调用**；2024-11-25 Python 库支持 functions as tools。来源：[Tool support](https://ollama.com/blog/tool-support)（2024-07-25）、[Streaming responses with tool calling](https://ollama.com/blog/streaming-tool)（2025-05-28）、[Ollama Python library 0.4](https://ollama.com/blog/functions-as-tools)（2024-11-25）。
- **Agent 能力**：2026-01-15 支持 **OpenAI Codex CLI**；2026-01-16 兼容 **Anthropic Messages API**（可用 Claude Code + 开源模型）；2026-01-23 推出 `ollama launch`（一条命令跑 Claude Code / OpenCode / Codex）；2026-02-16 支持 **Claude Code 子代理与 web search**；2026-08-25 支持 **Claude Desktop 作为第三方 gateway**。来源：[Codex](https://ollama.com/blog/codex)（2026-01-15）、[Claude Code with Anthropic API compatibility](https://ollama.com/blog/claude)（2026-01-16）、[ollama launch](https://ollama.com/blog/launch)（2026-01-23）、[Subagents and web search in Claude Code](https://ollama.com/blog/web-search-subagents-claude-code)（2026-02-16）、[Claude Desktop support with Ollama](https://ollama.com/blog/claude-desktop)（2026-08-25）。
- **引擎**：2026-03-30 Apple Silicon 上引入 **MLX**（预览）；2026-06-11 MLX 性能更新；2026-06-29 Gemma 4 在 MLX 上用 MTP 最高提速 90%；2026-06-05 Ollama 0.30 通过 llama.cpp 改进 GGUF 兼容。来源：[MLX preview](https://ollama.com/blog/mlx)（2026-03-30）、[MLX performance](https://ollama.com/blog/mlx-performance)（2026-06-11）、[Faster Gemma 4 on MLX](https://ollama.com/blog/faster-gemma-4-mlx-mtp)（2026-06-29）、[GGUF improvements](https://ollama.com/blog/improved-performance-and-model-support-with-gguf)（2026-06-05）。
- **商业模式**：**开源 MIT（本地运行时）+ 商业云服务**。2026-08-31 起改为业界标准**按 token 透明计价**：Free $0（含起步额度）、Pro $20/月、Max $100/月、Team $500/月、Enterprise 定制；**「Running models on your own hardware is always unlimited」**（自有硬件上跑模型永远不限量）。来源：[Ollama's transparent pricing](https://ollama.com/blog/transparent-pricing)（2026-08-31）、[Pricing](https://ollama.com/pricing)（2026-09-27）。
- **隐私承诺（原文）**：*"Prompt or response data is never logged or trained on."*；云模型**主要托管在美国**，可能路由至欧洲与新加坡；与 NVIDIA Cloud Providers 合作，要求 no logging / no training / zero data retention。来源：[Pricing FAQ · Privacy](https://ollama.com/pricing)（2026-09-27）。
- **MCP 支持**：**未找到公开数据**（未能在 `docs.ollama.com` 抓到原生 MCP 支持页面）。
- **下载量**：**未找到公开数据**（仅有 890 万开发者的厂商自述）。

### 1.3 LM Studio

- **定位**：闭源商业桌面应用（macOS / Windows / Linux），运行本地 LLM（llama.cpp + MLX 引擎）。开发方为 **Element Labs, Inc.**。来源：[LM Studio Pricing 页脚](https://lmstudio.ai/pricing)（2026-09-27）。
- **MCP 支持（关键事实）**：**自 0.3.17 起 LM Studio 作为 MCP Host**，支持**本地与远程 MCP server**，通过应用内 `mcp.json`（沿用 Cursor 的记法）配置，并提供 deeplink 安装按钮。官方明确警告：*"Some MCP servers can run arbitrary code, access your local files, and use your network connection."* 以及 *"Some MCP servers were designed to be used with Claude, ChatGPT, Gemini and might use excessive amounts of tokens... It may quickly bog down your local model and trigger frequent context overflows."* 来源：[Use MCP Servers · LM Studio Docs](https://lmstudio.ai/docs/app/mcp)（抓取于 2026-09-27）；发布说明见 [MCP in LM Studio](https://lmstudio.ai/blog/lmstudio-v0.3.17)（2025-06-25）。
- **Agent 能力**：**2026-07-16 发布 LM Studio Bionic —— 「the AI agent for open models」**；2026-08-17 支持 **Skills**；2026-08-27 发布 **Auto Review**（AST 解析 + 命令匹配，用于安全执行 shell 命令）；2026-09-17 支持 **Session References 与会话内省**。来源：[Introducing LM Studio Bionic](https://lmstudio.ai/blog/introducing-lm-studio-bionic)（2026-07-16）、[Bionic now supports skills](https://lmstudio.ai/blog/skills)（2026-08-17）、[How Auto Review works in Bionic](https://lmstudio.ai/blog/how-auto-review-works)（2026-08-27）、[Session References and Introspection](https://lmstudio.ai/blog/introducing-introspection)（2026-09-17）。
- **版本节奏**：0.3.17（2025-06-25，MCP）→ 0.3.39（2026-01-15，Open Responses）→ **0.4.0（2026-01-28：服务端部署、连续批处理并行请求、新 REST API、UI 刷新）**。来源：[LM Studio 0.4.0](https://lmstudio.ai/blog/0.4.0)（2026-01-28）。
- **商业模式**：**本地运行免费（含商用）**，2025-07-08 官方宣布「LM Studio is free for use at work」，无需商业许可。云端推理走 **Bionic**：**Bionic+ $20/月、Pro $100/月**，**US-hosted、Zero Data Retention (ZDR)**。来源：[LM Studio is free for use at work](https://lmstudio.ai/blog/free-for-work)（2025-07-08）、[Bionic Pricing](https://lmstudio.ai/pricing)（2026-09-27）。
- **硬件合作**：2026-03-18 支持 **NVIDIA DGX Station GB300**；2025-10-14 随 NVIDIA DGX Spark 发布 Linux ARM 版。来源：[Run open models on NVIDIA DGX Station GB300](https://lmstudio.ai/blog/dgx-station)（2026-03-18）、[NVIDIA DGX Spark](https://lmstudio.ai/blog/dgx-spark)（2025-10-14）。
- **移动端**：2026-04-08 **Locally AI 团队加入 LM Studio**；2026-06-04 通过 Locally（LM Studio 的移动 app）在 iPhone / iPad 上运行本地模型。来源：[Locally AI joins LM Studio](https://lmstudio.ai/blog/locally-ai-joins-lm-studio)（2026-04-08）、[Run (your largest) local models from your iPhone](https://lmstudio.ai/blog/locally-lm-link)（2026-06-04）。
- **下载量/用户量**：**未找到公开数据**。

### 1.4 Jan

- **定位（仓库自述）**：*"Jan is an open source alternative to ChatGPT that runs 100% offline on your computer."* 来源：`https://api.github.com/repos/janhq/jan`（2026-09-27）。
- **量级**：44,663 star / 3,058 fork，语言 **Rust**，2026-09-25 有提交 ✅。同上。
- **许可证**：GitHub API 返回 `NOASSERTION`（**非标准/自定义许可，具体条款未抓到，未证实**）。同上。
- **MCP 支持 / 工具调用 / 商业模式 / 最新版本**：**未找到公开数据**（`https://jan.ai/` 抓取失败，fetch failed）。

### 1.5 GPT4All

- **量级与状态**：77,378 star / 8,284 fork，MIT 许可，**`pushed_at = 2025-05-27`**，即**代码推送已停滞约 16 个月**；仓库**未被归档（archived: false）**，star 数仍在增长（`updated_at = 2026-09-27`）。来源：`https://api.github.com/repos/nomic-ai/gpt4all`（2026-09-27）。
- **定位**：*"Run Local LLMs on Any Device. Open-source and available for commercial use."* 同上。
- **⚠️ 判断**：这是本赛道**最清晰的「高人气 + 事实停更」信号**——MIT 许可 + 7.7 万 star 的资产处于低维护状态，但**官方是否宣布停止维护：未找到公开数据**，因此严格来说只能判定为「事实停更」，不能断言「已废弃」。

### 1.6 Cherry Studio

- **定位（仓库自述）**：*"AI productivity studio with smart chat, autonomous agents, and 300+ assistants. Unified access to frontier LLMs"*；主页 `cherryai.com`；topics 包含 `agent-skills`、`ai-agent`、`claude-code`、`codex`、`deepseek`、`hermes-agent`、`skills`、`vibe-coding`。来源：`https://api.github.com/repos/CherryHQ/cherry-studio`（2026-09-27）。
- **量级**：52,166 star / 5,012 fork，**AGPL-3.0**，2026-09-27 有提交 ✅。同上。
- **定位变化（值得注意）**：仓库描述与 topics 显示其重心已从「本地模型客户端」转向**聚合前沿 LLM + agent skills**（topics 里出现 `claude-code`、`codex`、`vibe-coding`），即**云端模型聚合而非纯本地推理**。同上。
- **MCP 支持 / 最新版本 / 商业模式细节**：**未找到公开数据**。

### 1.7 AnythingLLM

- **定位（仓库自述）**：*"Stop renting your intelligence. Own it with AnythingLLM. Everything you need for a powerful local-first agent experience"*；topics 含 `local-ai`、`localai`、`rag`、`self-hosted-ai`、`agent-computer`、`agent-harness`、`computer-use`。来源：`https://api.github.com/repos/Mintplex-Labs/anything-llm`（2026-09-27）。
- **量级**：66,509 star / 7,409 fork，**MIT**，2026-09-26 有提交 ✅，主页 `anythingllm.com`。同上。
- **MCP / 工具调用 / 云托管商业版定价**：**未找到公开数据**（官网未抓取）。

### 1.8 Open WebUI

- **定位**：*"User-friendly AI Interface (Supports Ollama, OpenAI API, ...)"*，自托管 LLM Web UI；**topics 明确包含 `mcp`**。来源：`https://api.github.com/repos/open-webui/open-webui`（2026-09-27）。
- **量级**：**153,283 star / 22,431 fork**（本报告中 star 最高的自托管 UI），2026-09-26 有提交 ✅。同上。
- **许可证**：GitHub API 返回 `NOASSERTION`——Open WebUI 采用带品牌保护条款的自定义许可（**具体条款未抓到，未证实**）。同上。
- **MCP 的具体接入方式（是否经 `mcpo` 代理）、企业版定价**：**未找到公开数据**。

### 1.9 Msty

- **结论：未找到公开数据**（`msty.app` 未抓取成功）。

### 1.10 2026 年新出现的相关产品（来自 Ollama 官方博客，仅有一手引述）

- **OpenJarvis**：Ollama 博客称 *"OpenJarvis v1.0 is now available: an open-source framework for building personal AI agents that run on your own hardware, with Ollama support built-in."* 来源：[OpenJarvis](https://ollama.com/blog/openjarvis)（2026-05-28）。官网/仓库 URL：**未找到公开数据**。
- **OpenClaw**：Ollama 博客称 *"OpenClaw is a personal AI assistant that connects your messaging apps to local AI coding agents, all running on your own device."* 来源：[OpenClaw](https://ollama.com/blog/openclaw)（2026-02-01）、[The simplest and fastest way to setup OpenClaw](https://ollama.com/blog/openclaw-tutorial)（2026-02-23）。官网/仓库 URL：**未找到公开数据**。
- **其他 2026 年新模型（Ollama 博客，可作为端侧模型能力进展的证据）**：NVIDIA Nemotron 3.5 Lightning（30B 总参 / 3B 激活，面向"常驻 agent"，2026-08-11）、Meta Muse Glimmer（Meta Superintelligence Labs 首个开源模型，30B 多模态，Apache 2.0，面向本地 coding agent，2026-08-10）。来源：https://ollama.com/blog

### 1.11 桌面端对比表

| 产品 | star（2026-09-27） | 本地推理 | 工具调用 | MCP | 开源许可 | 商业模式 | 最新动态 |
|---|---|---|---|---|---|---|---|
| Ollama | 181,786 | ✅ 核心 | ✅（2024-07 起） | 未找到公开数据 | MIT | 开源 + 云按 token 计费（Pro $20/Max $100/Team $500） | 2026-08-31 透明计价；2026-08-25 Claude Desktop gateway |
| Open WebUI | 153,283 | 依赖后端 | 未找到公开数据 | topics 含 `mcp`，细节未找到 | 自定义（NOASSERTION） | 未找到公开数据 | 2026-09-26 活跃 |
| GPT4All | 77,378 | ✅ | 未找到公开数据 | 未找到公开数据 | MIT | 开源 | **2025-05-27 后停更** |
| AnythingLLM | 66,509 | ✅ local-first | 未找到公开数据 | 未找到公开数据 | MIT | 有商业版（定价未找到） | 2026-09-26 活跃 |
| Cherry Studio | 52,166 | 支持（经 Ollama 等） | ✅（自述 autonomous agents） | 未找到公开数据 | AGPL-3.0 | 未找到公开数据 | 2026-09-27 活跃；转向前沿 LLM 聚合 |
| Jan | 44,663 | ✅ 100% offline | 未找到公开数据 | 未找到公开数据 | 自定义（NOASSERTION） | 未找到公开数据 | 2026-09-25 活跃 |
| **LM Studio** | 闭源（CLI 5,321） | ✅ | ✅（Bionic Agent） | ✅ **0.3.17 起为 MCP Host** | **闭源** | 本地免费含商用 + 云 Bionic+ $20/Pro $100 | 2026-09-17 会话内省 |
| Msty | 未找到公开数据 | — | — | — | 闭源（据定位） | 未找到公开数据 | 未找到公开数据 |

---

## 2. 浏览器扩展 / 网页内的 AI 助手

### 2.1 云端扩展型助手

- **Merlin**（`getmerlin.in`）：
  - 自述 **"Trusted by 20M+ users"**（2000 万+ 用户），"Available in 200+ countries"，Chrome Web Store 评分 4.8。
  - 形态：Chrome 扩展 + 网页版 Chat + Agent 页 + 移动 app（Google Play / App Store）。
  - **数据是否上云：是**（纯云端，聚合 o3 / o4-mini / GPT-4.1 / Claude 3.7 Sonnet / DeepSeek R1 / Gemini 2.5 / Mistral Large / Llama 3.1 405B / Grok 3 等模型）——**无任何本地推理表述**。
  - 定价：页面宣传 "$130 worth of value for just $19"（约 $19/月）。
  - ⚠️ **时效存疑**：页面所列模型仍停留在 2025 年上半年一代（o3、GPT-4.1、Claude 3.7、Grok 3），**疑似内容久未更新**，其"20M+ users"亦为厂商自述、未经第三方验证。
  - 来源：[Merlin 官网](https://www.getmerlin.in/)（抓取于 2026-09-27）。
- **Sider**（`sider.ai`）、**Monica**（`monica.im`）、**Harpa**（`harpa.ai`）：**均未找到公开数据**——`sider.ai/pricing`、`monica.im/pricing` 抓取失败（fetch failed），`harpa.ai` 跨域重定向后未继续抓取。
- **Chrome 自带 Gemini 集成**：**未找到公开数据**——`blog.google/products/chrome/gemini-in-chrome/` 返回 **HTTP 404**，说明该确切 URL 不存在（**不能据此推断功能不存在**）。
- **Chrome built-in AI / Gemini Nano（Prompt API 等）**：**本文件未找到公开数据**——`developer.chrome.com/docs/ai/built-in` 与 `/docs/ai/built-in-apis` 均抓取失败（fetch failed）。
  → **但该条已有结论，见姊妹篇** [`browser-runtime-landscape-2026-09.md` §2](browser-runtime-landscape-2026-09.md)：Prompt API 规范已把原生工具调用（`LanguageModel.create({ tools })`）与 `responseConstraint` 写入设计，`availability()` 四值明确；仍缺的只有 Chrome/Edge 的具体版本与平台覆盖。
- **Edge Copilot Mode**：**未找到公开数据**。
- **Arc / Dia（The Browser Company）**：**未找到公开数据**——`thebrowser.company` 跨域重定向至 `www.thebrowser.company`，未继续抓取。
- **Comet（Perplexity）**：**未找到公开数据**——`perplexity.ai/comet` 抓取失败。

> ⚠️ **本节结论的置信度最低**。浏览器侧厂商页面普遍抓取失败（fetch failed / 跨域重定向 / 404），因此**不对"是否上传数据""是否本地推理"做任何断言**。唯一可核查的一手结论是：**Merlin 是纯云端形态、无本地推理表述**。

### 2.2 浏览器内本地推理（In-browser inference）

- **WebLLM（`mlc-ai/web-llm`）**：
  - 定位（仓库自述）：*"High-performance In-browser LLM Inference Engine"*，主页 `https://webllm.mlc.ai`，topics 含 `webgpu`、`webml`。
  - 量级：**19,195 star / 1,384 fork**，**Apache-2.0**，`pushed_at = 2026-09-15` ✅ **仍活跃**（创建于 2023-04-13）。
  - 来源：`https://api.github.com/repos/mlc-ai/web-llm`（2026-09-27）。
- **Transformers.js**（`huggingface/transformers.js` 或 `xenova/transformers.js`）：**未找到公开数据**（未抓取）。
- **PrivateGPT**（`zylon-ai/private-gpt`）：**未找到公开数据**（未抓取）。需注意其架构实为**本地服务端**（Python 后端 + 本地向量库），**并非浏览器内推理**——此为技术定性，非数据。
- **wllama / llama.cpp WASM / ONNX Runtime Web / WebGPU 浏览器支持现状**：**未找到公开数据**（未抓取）。
- **浏览器扩展作为 MCP client/host 的产品**：**未找到公开数据**。

> **可核查的对比点**：浏览器内推理的旗舰项目 WebLLM 有 **19,195 star**，而桌面端 Ollama 有 **181,786 star**——**桌面端量级约为浏览器内的 9.5 倍**（同一 API 口径、同一抓取时点）。这是本报告中最能说明"本地推理主战场在桌面而非浏览器"的量化证据。

---

## 3. MCP（Model Context Protocol）生态现状

### 3.1 规范演进（一手来源）

- **最新规范版本：`2026-07-28`**（官网导航显示 "Version 2026-07-28 (latest)"）。来源：[Specification](https://modelcontextprotocol.io/specification/2026-07-28)（抓取于 2026-09-27）。
- **2026-07-28 的核心变更**（相对上一版 `2025-11-25`）：
  1. **协议无状态化（最重要）**：**移除协议级 session 与 `Mcp-Session-Id` header**，**移除 `initialize` / `notifications/initialized` 握手**；每个请求自带协议版本与客户端能力（`_meta`）；新增 `server/discover` RPC；任何请求可落在普通轮询负载均衡后的任意实例上。
  2. **MRTR（Multi Round-Trip Requests）** 取代 server-initiated 请求（`roots/list`、`sampling/createMessage`、`elicitation/create`）：服务端返回 `resultType: "input_required"` + `inputRequests`，客户端带 `inputResponses` 重试原请求。
  3. **Header-based routing**：Streamable HTTP 请求必须带 `Mcp-Method`、`Mcp-Name`，便于网关 / 限流 / WAF 直接按 header 路由与计量。
  4. **列表结果可缓存**：`tools/list`、`prompts/list`、`resources/list`、`resources/read` 返回 `ttlMs` 与 `cacheScope`；并要求确定性顺序以提升 prompt cache 命中率。
  5. **授权加固**：RFC 9207 `iss` 校验、issuer-bound client credentials、DCR（动态客户端注册）**正式弃用**转向 **CIMD（Client ID Metadata Documents）**。
  6. **Tasks 移出核心**，成为官方扩展 `io.modelcontextprotocol/tasks`（轮询式 `tasks/get` + 新增 `tasks/update`）。
  7. **正式弃用**：**Roots、Sampling、Logging**（仍可用，**至少 12 个月宽限期**）；HTTP+SSE 传输正式弃用（一年过渡）。
  8. 引入**正式弃用政策（12 个月最短窗口）**。
  来源：[The 2026-07-28 Specification](https://blog.modelcontextprotocol.io/posts/2026-07-28/)（2026-07-28）、[Key Changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)（抓取于 2026-09-27）。
- **扩展体系**：官方扩展包括 **Tasks**（AWS 贡献）、**MCP Apps**（对话内联渲染图表/表单/视频等交互 UI）、**Enterprise Managed Authorization (EMA)**（已 stable）、**Skills over MCP**。来源：[Specification · Extensions](https://modelcontextprotocol.io/specification/2026-07-28)、[The New MCP Roadmap](https://blog.modelcontextprotocol.io/posts/mcp-roadmap/)（2026-08-22）。
- **治理**：已采纳 **Contributor Ladder**、**feature lifecycle and deprecation policy**、Working Groups 分区 triage SEP；MCP 归 **LF Projects, LLC** 旗下。来源：同上。
- **规范版本时间线**：可确证的相邻版本为 **2025-11-25**（上一版）与 **2026-07-28**（当前版）；`2025-03-26` 版存在（HTTP+SSE 自该版起被弃用）。其余中间版本号：**未找到公开数据**。

### 3.2 采用量级（一手，厂商/官方口径）

- **「Across our Tier 1 SDKs, we're seeing close to half-a-billion downloads a month, with both TypeScript and Python SDKs crossing the 1 billion total downloads threshold.」**
  → **Tier 1 SDK 月下载接近 5 亿次；TypeScript 与 Python SDK 累计下载均突破 10 亿次。**
  来源：[The 2026-07-28 Specification](https://blog.modelcontextprotocol.io/posts/2026-07-28/)（2026-07-28）。
- **Tier 1 SDK**：TypeScript、Python、Go、C# 均已支持 `2026-07-28`；**Rust SDK 为 beta**。同上。
- **GitHub 量级**：`modelcontextprotocol/modelcontextprotocol` 9,315 star；`modelcontextprotocol/registry` 7,286 star。来源：`https://api.github.com/repos/modelcontextprotocol/...`（2026-09-27）。

### 3.3 Registry

- **状态：preview（预览）**。官方原文：*"The MCP Registry is currently in preview. Breaking changes or data resets may occur before general availability."* 来源：[The MCP Registry](https://modelcontextprotocol.io/registry/about)（抓取于 2026-09-27）。
- **参与方**：由 **Anthropic、GitHub、PulseMCP、Microsoft** 等主要生态贡献者支持。同上。
- **机制**：`server.json` 标准化元数据；**反向 DNS 命名空间 + DNS/GitHub 验证**确保来源可信；**不支持私有 server**（私有应自建私有 registry）；官方 registry 代码库**不支持自托管**；安全扫描**委托给下游**（"The MCP Registry delegates security scanning..."，页面在此处被截断，**具体委托对象未抓到**）；主要消费者是**下游聚合器/市场**，而非 host 应用直接消费。同上。
- **server 总数**：**未找到公开数据**（未抓到 registry API 统计端点）。

### 3.4 主要厂商采用（关键证据来自 2026-07-28 官方博文的署名引述）

| 厂商/组织 | 表述（官方博文引述） | 来源 |
|---|---|---|
| **AWS** | "the new MCP specification and its stateless protocol core available in **Amazon Bedrock AgentCore**"；**Tasks 扩展由 AWS 贡献** | [2026-07-28 博文](https://blog.modelcontextprotocol.io/posts/2026-07-28/) |
| **Microsoft** | "**MCP is foundational to Microsoft Foundry**, enabling us to scale from dozens of integrations to thousands"；Foundry toolbox 统一 MCP endpoint 集中治理/身份/可观测性 | 同上 |
| **Google Cloud** | "we are excited to leverage these powerful new capabilities across our ecosystem of developer tools" | 同上 |
| **Cloudflare** | "**Cloudflare's Agents SDK supports the spec from day zero**"；可在 Workers 内直接运行 MCP server | 同上 |
| **Figma** | "More builders are using our MCP server to bring generated outputs into Figma's canvas" | 同上 |
| **Netlify** | "Our customers wanted MCPs on Netlify to be as simple as the rest of the platform" | 同上 |
| **honeycomb.io** | "nearly **20% of all monthly interactive queries are now made by agents**" | 同上 |
| **Manufact** | mcp-use 框架：新 SDK v2 使包体积减少约 **83%**、速度提升 **25%** | 同上 |
| **FastMCP / Horizon** | FastMCP 4.0 将支持后台任务、无状态交互、企业 auth | 同上 |
| OpenAI / Anthropic / Apple / Meta / xAI / 中国厂商（阿里、腾讯、字节、DeepSeek） | **未找到公开数据**（未抓到各自的 MCP 官方文档页） | — |

### 3.5 安全事件与担忧

- **官方立场（一手）**：MCP 规范本身设 "Security and Trust & Safety" 章节，明确 *"The Model Context Protocol enables powerful capabilities through arbitrary data access and code execution paths."* 来源：[Specification](https://modelcontextprotocol.io/specification/2026-07-28)。
- **实现方警告（一手）**：LM Studio 文档明确提示 *"Never install MCPs from untrusted sources... Some MCP servers can run arbitrary code, access your local files, and use your network connection."* 来源：[Use MCP Servers](https://lmstudio.ai/docs/app/mcp)。
- **规范层面的安全加固**（可视为对真实攻击面的回应）：RFC 9207 `iss` 校验（"closes an authorization-server mix-up hole"）、issuer-bound credentials、CIMD 取代 DCR。来源：[2026-07-28 博文](https://blog.modelcontextprotocol.io/posts/2026-07-28/)。
- **⚠️ 具体安全事件/CVE：未找到公开可核查的事件记录。** 本会话搜索通道受限（Bing 返回噪声、其他搜索引擎被拦截），**未抓到任何 CVE 编号或厂商安全公告，因此不做任何具体事件的断言**（包括常见的 tool poisoning、rug pull 等说法，均未证实）。

### 3.6 浏览器 / 端侧运行 MCP 的可能性

- **可核查的规范事实**：`2026-07-28` 之后 **remote MCP server 与普通 HTTP workload 无异**（无状态、无 session），路线图明确下一步是 **"HTTP-native transport unification and hardening"**，包括 **让本地 server 通过 stdio 讲 Streamable HTTP**，统一到单一传输层。来源：[The New MCP Roadmap](https://blog.modelcontextprotocol.io/posts/mcp-roadmap/)（2026-08-22）。
- **这对浏览器意味着什么（技术推论，非事实断言）**：无状态 + 纯 HTTP 的设计在原理上更贴合浏览器/边缘运行环境（Cloudflare 已在 Workers 内运行 MCP server 并 day-zero 支持，见 3.4）；但**浏览器扩展作为 MCP host/client 的现成产品、以及 Chrome built-in AI 与 MCP 的关系，均未找到公开数据**。
- **"agent 在浏览器里调用工具"的主流解法**：**未找到公开数据**（未抓到 browser-use、Playwright MCP、Chrome DevTools MCP 等项目的可核查页面）。
- **路线图确认的痛点（一手，对"浏览器里工具太多"有直接含义）**：*"Connecting to a server with a hundred tools means the model pays for that entire surface before the user has asked a single question, and tool selection tends to get worse as the list grows."* → 官方已启动 **progressive discovery（渐进式工具发现）** 工作。来源：[The New MCP Roadmap](https://blog.modelcontextprotocol.io/posts/mcp-roadmap/)（2026-08-22）。

---

## 4. 企业 / 合规驱动的离线部署需求

> **本节绝大部分条目为「未找到公开数据」**：GDPR/EU AI Act、中国数据出境、金融/医疗/军工监管文件、Copilot+ PC、Apple Intelligence、Intel/AMD/Qualcomm NPU 的官方页面在本会话中**均未能抓取成功**（fetch failed 或跨域重定向）。以下仅列出可核查的间接证据。

### 4.1 可核查的间接证据：厂商如何宣传"隐私 / 本地"

以下为**实际抓取到的官网原文**（这是本节唯一可靠的一手材料）：

| 厂商 | 原文宣传语 | 来源（抓取于 2026-09-27） |
|---|---|---|
| **Ollama** | *"Running models on your own hardware is always unlimited."* | [ollama.com/pricing](https://ollama.com/pricing) |
| **Ollama** | *"Prompt or response data is never logged or trained on."*；合作方需满足 *"no logging, no training, and zero data retention policies"* | 同上 |
| **LM Studio** | *"Bionic cloud inference is US-hosted, with Zero data retention (ZDR)"* | [lmstudio.ai/pricing](https://lmstudio.ai/pricing) |
| **LM Studio** | 免费层即含 *"Run local LLMs on your machine"*、*"State-of-the-art offline voice transcription"*、*"LM Link for up to 5 devices"* | 同上 |
| **Jan** | *"runs 100% offline on your computer"* | [GitHub 仓库描述](https://api.github.com/repos/janhq/jan) |
| **AnythingLLM** | *"Stop renting your intelligence. Own it with AnythingLLM."*、*"powerful local-first agent experience"* | [GitHub 仓库描述](https://api.github.com/repos/Mintplex-Labs/anything-llm) |
| **GPT4All** | *"Run Local LLMs on Any Device. Open-source and available for commercial use."* | [GitHub 仓库描述](https://api.github.com/repos/nomic-ai/gpt4all) |
| **LM Studio** | *"Use your LM Studio Models in Claude Code"*（本地模型接入 coding agent） | [lmstudio.ai/blog/claudecode](https://lmstudio.ai/blog/claudecode)（2026-01-30） |
| **Ollama** | *"OpenClaw is a personal AI assistant that connects your messaging apps to local AI coding agents, all running on your own device."* | [ollama.com/blog/openclaw](https://ollama.com/blog/openclaw)（2026-02-01） |

> **一个反直觉的观察（基于原文措辞）**：这两家最主流的"本地推理"厂商，**其隐私叙事已从"数据不出本地"迁移为"本地不限量 + 云端零留存（ZDR）"**。Ollama 的云模型*主要托管在美国*并可能路由至欧洲/新加坡；LM Studio 的 Bionic 明确标注 *US-hosted*。也就是说，**"隐私优先"在 2026 年 9 月的主流表述是"零数据留存（ZDR）"与"自有硬件不限量"，而不是字面意义的"数据绝不出设备"**。

### 4.2 未找到公开数据的条目（明确列出，避免误导）

- GDPR / EU AI Act 的适用时间表（含 2026-08-02 节点与 digital omnibus 延期争议）：**未找到公开数据**。
- 中国《促进和规范数据跨境流动规定》及负面清单演进、数据出境合规对私有化部署的驱动：**未找到公开数据**。
- 金融 / 医疗 / 军工 / 政府内网的 LLM 合规要求（JR/T、HIPAA、DoD IL5/IL6、FedRAMP 等）：**未找到公开数据**。
- **Copilot+ PC**：NPU 算力门槛（常见说法为 40+ TOPS）、出货量/销量、Recall 的隐私争议与 GA 状态、Phi Silica / Windows AI Foundry 现状：**未找到公开数据**。
- **Apple Intelligence / Apple Neural Engine / Private Cloud Compute / Foundation Models framework 是否向第三方开放端侧模型**：**未找到公开数据**。
- **Intel / AMD / Qualcomm 的 NPU TOPS 数据与 2026 年新品、AI PC 出货量预测（Canalys/Counterpoint/IDC）**：**未找到公开数据**。
- **NVIDIA DGX Spark / DGX Station 在 2026 年的进展**：**部分可核查**——LM Studio 官方博客确认 2026-03-18 支持 **NVIDIA DGX Station GB300**（"GB300 Blackwell in a form factor you can run outside of the data center"），2025-10-14 随 DGX Spark 发布 Linux ARM 版。来源：[dgx-station](https://lmstudio.ai/blog/dgx-station)（2026-03-18）、[dgx-spark](https://lmstudio.ai/blog/dgx-spark)（2025-10-14）。

---

## 5. 市场数据

### 5.1 已核查到的权威数据（附原文摘录）

| 指标 | 数值 | 来源机构 | 发布日期 | 来源 URL | 原文摘录 |
|---|---|---|---|---|---|
| 企业生成式 AI 支出（2025） | **$370 亿**（同比 **3.2x**，2024 为 $115 亿） | Menlo Ventures | 2025-12-09 | [2025: The State of Generative AI in the Enterprise](https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise/) | *"Our data indicates companies spent **$37 billion** on generative AI in 2025, up from **$11.5 billion** in 2024, a **3.2x** year-over-year increase."* |
| 企业 AI 占全球 SaaS 市场比例 | **6%** | Menlo Ventures | 2025-12-09 | 同上 | *"Enterprise AI spend surged to **$37B** in 2025, capturing **6%** of the global SaaS market"* |
| 企业 AI 支出中应用层占比 | **$190 亿**（>50%） | Menlo Ventures | 2025-12-09 | 同上 | *"**\>50%** of enterprise AI spend went to AI apps (**$19B**)"* |
| 企业 LLM API 市场份额 | **Anthropic 40%**，OpenAI **27%** | Menlo Ventures | 2025-12-09 | 同上 | *"Anthropic commands **40%** enterprise LLM API market share, compared to **27%** for OpenAI."* |
| 企业 AI「买 vs 自建」 | **76% 外购**（2024 为 53%） | Menlo Ventures | 2025-12-09 | 同上 | *"Today, **76%** of AI use cases are purchased rather than built internally."* |
| 消费者 AI 支出（2026） | **约 $400 亿**（同比增长 3 倍以上） | Menlo Ventures | **2026-09-16** | [2026: The State of Consumer AI](https://menlovc.com/perspective/2026-the-state-of-consumer-ai/) | *"We estimate consumer AI spend has reached **$40 billion**, more than triple what we measured a year ago."* |
| 美国成年人 AI 采用率 | **61% → 64%**（仅涨 3 个百分点） | Menlo Ventures | **2026-09-16** | 同上 | *"overall adoption rose just three points, from **61%** to **64%** of U.S. adults. Instead, growth came from existing users doing more with AI."* |
| Ollama 开发者数 | **890 万**（厂商自述） | Ollama | 2026-07-09 | [all aboard open models](https://ollama.com/blog/all-aboard-open-models) | *"Serving **8.9 million developers**, Ollama has raised **$88M** from Benchmark, Theory Ventures, 8VC, Y Combinator..."* |
| MCP Tier 1 SDK 月下载量 | **接近 5 亿次/月**；TS 与 Python SDK 累计各破 **10 亿** | MCP 官方 | 2026-07-28 | [The 2026-07-28 Specification](https://blog.modelcontextprotocol.io/posts/2026-07-28/) | *"Across our Tier 1 SDKs, we're seeing close to **half-a-billion downloads a month**, with both TypeScript and Python SDKs crossing the **1 billion** total downloads threshold."* |

> **关键结构性发现**：Menlo 2026 消费者报告指出，**2026 年消费者 AI 支出的三倍增长并非来自新用户**（采用率仅 61%→64%），而是**存量用户加深使用**。这意味着**端侧/本地 AI 的增长空间不在"拉新"，而在"从云端存量用户中切分高隐私敏感场景"**。

### 5.2 未找到公开数据（明确列出）

- **"local LLM market size" / "on-device AI market size" 的独立市场规模预测**：**未找到公开数据**。Gartner 新闻稿、IDC 新闻稿、Canalys / Counterpoint 的 AI PC 出货量预测、Grand View Research / MarketsandMarkets 等二线机构的本地 LLM 报告——**本次均未能抓取到**（搜索引擎被拦截，且未能定位到可直连的官方新闻稿 URL）。
- **AI PC 出货量与占比预测**：**未找到公开数据**。
- **端侧推理的用户采用率**（Chrome built-in AI 使用率、Copilot+ PC 激活率、LM Studio 用户数等）：**未找到公开数据**（仅 Ollama 的 890 万开发者与 Merlin 的 2000 万用户为厂商自述）。

---

## 6. 失败 / 教训

### 6.1 可核查的案例

**案例 A：GPT4All —— "高人气 + 事实停更"**
- 事实：77,378 star、8,284 fork、MIT 许可、描述仍为 *"Run Local LLMs on Any Device"*，但 **`pushed_at = 2025-05-27`**，即**代码推送停滞约 16 个月**；仓库未归档，star 仍在增长（`updated_at = 2026-09-27`）。
- 来源：`https://api.github.com/repos/nomic-ai/gpt4all`（2026-09-27）。
- 教训（推论）：**在本地模型工具赛道，"先发 + 高 star + 宽松许可"并不构成护城河**——一旦底层引擎（llama.cpp/MLX）与模型生态快速演进，缺乏持续工程投入的产品会迅速失去相关性。对比 Ollama 在同一时期连续投入 MLX 引擎、MCP/agent 集成与云商业化。
- ⚠️ **官方是否宣布停止维护：未找到公开数据**，故只能判定为"事实停更"，不能断言"已废弃"。

**案例 B：Cherry Studio —— 从"本地客户端"转向"前沿 LLM 聚合"**
- 事实：仓库描述为 *"Unified access to frontier LLMs"*，topics 含 `claude-code`、`codex`、`deepseek`、`vibe-coding`、`agent-skills`，而**不再以本地推理为核心卖点**；star 52,166、2026-09-27 活跃。
- 来源：`https://api.github.com/repos/CherryHQ/cherry-studio`（2026-09-27）。
- 教训（推论）：**"本地模型客户端"这一品类本身的商业价值正在被稀释**——当开源模型能力足够强、云端 API 价格足够低（Ollama 云上 gpt-oss:20b 输入仅 $0.07/M token）时，客户端的最优策略是**聚合前沿模型**而非坚持本地推理。**这是"本地优先"叙事被商业化侵蚀的直接证据**。

**案例 C：LM Studio 与 Ollama 的"云化转向"（不是失败，但是同一结构性压力的表现）**
- 事实：两家最主流的本地推理厂商**都在 2026 年推出了按量计费的云推理**——Ollama 2026-08-31 改按 token 计价（Pro $20 / Max $100 / Team $500），LM Studio 2026-07-16 发布 Bionic Agent 并以 Bionic+ $20 / Pro $100 变现，均强调 **US-hosted + ZDR**。
- 来源：[Ollama transparent pricing](https://ollama.com/blog/transparent-pricing)（2026-08-31）、[Introducing LM Studio Bionic](https://lmstudio.ai/blog/introducing-lm-studio-bionic)（2026-07-16）、[LM Studio Pricing](https://lmstudio.ai/pricing)。
- 教训（推论）：**纯本地推理难以独立支撑商业模型**——免费层承担获客，收入来自"本地跑不动的大模型"上云。这解释了为什么"隐私优先"的措辞从"数据不出本地"退让为"零数据留存"。

### 6.2 未找到公开数据的案例

- **浏览器内跑 LLM 的创业产品关停/转型记录**：**未找到公开数据**。
- **本地 AI 浏览器扩展停更记录**：**未找到公开数据**。
- **Rewind AI → Limitless 转型、Humane AI Pin 停售、Rabbit R1 现状**：**未找到公开数据**（未抓到媒体报道页面）。
- **Stability AI 端侧尝试、local-first AI 笔记应用关停**：**未找到公开数据**。

> ⚠️ **诚实说明**：第 6 节的"失败案例"检索是本次调研**最受限**的部分。搜索通道被拦截导致无法定位媒体报道 URL，因此**只有 GitHub API 的时间戳能提供客观的"停滞"证据**（GPT4All）。任何未在此列出的"某某产品失败"说法，本报告均不予采纳。

---

## 7. 这个赛道的 5 个结构性机会与 5 个结构性风险

### 5 个结构性机会

1. **"本地优先 + 零留存云"的混合架构是唯一被验证可行的商业形态**——Ollama 与 LM Studio 双双在 2026 年转向"本地免费不限量 + 云按量计费 + ZDR"，说明用户愿意为"隐私承诺"付费但不愿为"纯离线"付费；谁能把"数据不出设备"做成**可审计的技术保证**（而非营销话术），谁就能吃到合规溢价。
2. **MCP 无状态化（2026-07-28）把"本地工具"接入了主流 agent 生态**——移除 session 与握手后，MCP server 与普通 HTTP workload 无异，本地私有工具可以低成本暴露给云端 agent；LM Studio 已从 0.3.17 起做 MCP Host，这是端侧产品**从"聊天玩具"升级为"agent 执行层"**的窗口期。
3. **企业外购率从 53% 升到 76%，但合规敏感行业（金融/医疗/军工/政府）仍难以采购公有云方案**——Menlo 数据显示企业 AI 支出 3.2x 增长且以"外购"为主，而合规内网场景**结构性排斥 SaaS**，这是本地化部署供应商最确定的空白市场。
4. **工具规模爆炸催生"渐进式工具发现"的中间层机会**——MCP 官方已承认"连接 100 个工具的 server 会让模型在用户提问前就付出全部上下文成本，且工具选择质量随列表增长而下降"；面向端侧小模型的**工具检索/裁剪/路由层**是明确的未被满足需求。
5. **桌面端本地推理的量级是浏览器内的约 9.5 倍（181,786 vs 19,195 star）**——资源应集中在桌面/端侧常驻 agent（Ollama 的 OpenClaw、LM Studio 的 Bionic Agent 方向），而非浏览器内 WASM 推理这条已被验证天花板较低的路线上。

### 5 个结构性风险

1. **"纯离线"的商业天花板已被厂商自己承认**——两家头部厂商的收入都来自云端推理，"本地"只是免费获客层；任何以"100% 离线"为核心卖点的新产品，都可能重演"高 star 但无收入"的路径（GPT4All 77,378 star 却事实停更）。
2. **端侧模型能力与云端差距在扩大而非缩小**——2026 年的前沿开源模型（Kimi K3、GLM 5.3、DeepSeek V4 Pro、Nemotron 3 Ultra）主要以上云方式提供，本地可跑的是 20B–30B 级别（Nemotron 3.5 Lightning 30B/3B 激活、Muse Glimmer 30B），**"本地够用"的前提随时可能被一次模型迭代打破**。
3. **MCP 的破坏性变更与弃用节奏会持续消耗集成方**——2026-07-28 一次性移除了 session 与 initialize 握手、弃用 Roots/Sampling/Logging（仅 12 个月宽限）；对端侧产品而言，**每次规范升级都是一次被迫重构**，而端侧团队通常规模远小于云端厂商。
4. **MCP 生态的安全模型把风险转移给了终端用户**——LM Studio 官方文档明确警告 MCP server 可执行任意代码、访问本地文件；registry 仍为 **preview**、不支持私有 server、安全扫描委托下游。**"本地执行任意工具"意味着本地产品是攻击面的最后一道防线**，一次严重事件即可摧毁整条赛道的信任基础。
5. **浏览器侧的证据基础极其薄弱且大厂正在收编入口**——本报告对 Sider/Monica/Chrome Gemini/Edge Copilot Mode/Comet/Dia **均未取得可核查数据**；同时 Chrome、Edge 等浏览器厂商正把 AI 助手做成系统级默认能力。**第三方浏览器扩展既缺乏本地推理能力（量级证据：WebLLM 19,195 star vs Ollama 181,786），又面临平台方直接竞争**，这是最不具防御性的位置。

---

## 附录：来源清单（全部为本次实际抓取）

| # | URL | 类型 | 抓取日期 |
|---|---|---|---|
| 1 | https://api.github.com/repos/ollama/ollama | GitHub API | 2026-09-27 |
| 2 | https://api.github.com/repos/janhq/jan | GitHub API | 2026-09-27 |
| 3 | https://api.github.com/repos/nomic-ai/gpt4all | GitHub API | 2026-09-27 |
| 4 | https://api.github.com/repos/CherryHQ/cherry-studio | GitHub API | 2026-09-27 |
| 5 | https://api.github.com/repos/Mintplex-Labs/anything-llm | GitHub API | 2026-09-27 |
| 6 | https://api.github.com/repos/open-webui/open-webui | GitHub API | 2026-09-27 |
| 7 | https://api.github.com/repos/mlc-ai/web-llm | GitHub API | 2026-09-27 |
| 8 | https://api.github.com/repos/modelcontextprotocol/modelcontextprotocol | GitHub API | 2026-09-27 |
| 9 | https://api.github.com/repos/modelcontextprotocol/registry | GitHub API | 2026-09-27 |
| 10 | https://api.github.com/orgs/lmstudio-ai/repos | GitHub API | 2026-09-27 |
| 11 | https://api.github.com/repos/lmstudio-ai/lmstudio-bug-tracker | GitHub API | 2026-09-27 |
| 12 | https://ollama.com/blog | 官方博客索引 | 2026-09-27 |
| 13 | https://ollama.com/blog/all-aboard-open-models | 官方博客（2026-07-09） | 2026-09-27 |
| 14 | https://ollama.com/pricing | 官方定价页 | 2026-09-27 |
| 15 | https://lmstudio.ai/docs/app/mcp | 官方文档 | 2026-09-27 |
| 16 | https://lmstudio.ai/pricing | 官方定价页 | 2026-09-27 |
| 17 | https://lmstudio.ai/blog | 官方博客索引 | 2026-09-27 |
| 18 | https://modelcontextprotocol.io/specification/2026-07-28 | 规范正文 | 2026-09-27 |
| 19 | https://modelcontextprotocol.io/specification/2026-07-28/changelog | 规范变更日志 | 2026-09-27 |
| 20 | https://modelcontextprotocol.io/registry/about | Registry 文档 | 2026-09-27 |
| 21 | https://blog.modelcontextprotocol.io/ | 官方博客索引 | 2026-09-27 |
| 22 | https://blog.modelcontextprotocol.io/posts/2026-07-28/ | 官方博客（2026-07-28） | 2026-09-27 |
| 23 | https://blog.modelcontextprotocol.io/posts/mcp-roadmap/ | 官方博客（2026-08-22） | 2026-09-27 |
| 24 | https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise/ | 权威报告（2025-12-09） | 2026-09-27 |
| 25 | https://menlovc.com/perspective/ | 报告索引（含 2026 消费者 AI，2026-09-16） | 2026-09-27 |
| 26 | https://www.getmerlin.in/ | 厂商官网 | 2026-09-27 |

**抓取失败 / 不可用的 URL（如实记录，未据此推断任何结论）**：
`https://developer.chrome.com/docs/ai/built-in`（fetch failed）、`https://developer.chrome.com/docs/ai/built-in-apis`（fetch failed）、`https://blog.google/products/chrome/gemini-in-chrome/`（HTTP 404）、`https://sider.ai/pricing`（fetch failed）、`https://monica.im/pricing`（fetch failed）、`https://www.harpa.ai/`（跨域重定向）、`https://thebrowser.company/`（跨域重定向）、`https://www.perplexity.ai/comet`（fetch failed）、`https://jan.ai/`（fetch failed）、`https://a16z.com/enterprise-ai-2026/`（HTTP 404）、`https://modelcontextprotocol.io/specification/2026-06-18/changelog`（HTTP 404，说明该版本号不存在）。

**搜索通道状态**：`web_search` 不可用（缺 API key）；`duckduckgo.com/html`、`lite.duckduckgo.com`、`html.duckduckgo.com`、`mojeek.com`、`startpage.com`、`google.com/search` 均失败或被拦截；仅 `cn.bing.com/search` 可返回结果但内容为噪声（返回词典义项等无关结果），**因此本报告的检索广度受限，凡未覆盖的主题均已标注「未找到公开数据」**。
