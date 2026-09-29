# 浏览器端运行大模型的技术格局与最新进展（截至 2026 年 9 月）

> **调研说明（必读）**
> - 调研时间：2026-09-27（所有「访问日期」均指该日）。
> - **方法学限制**：本次调研中 `web_search` 工具因缺少 API key 不可用，全部结论来自 `web_fetch` 直接抓取一手 URL。
> - **网络限制**：`developer.chrome.com`、`developer.mozilla.org`、`learn.microsoft.com`、`web.archive.org`、`chromestatus.com`、`r.jina.ai`、`caniuse.com/features-json` 在本会话中被网络策略拦截（fetch 直接失败），`curl`/`Invoke-WebRequest` 亦无法建立 TLS 连接。
> - 因此：凡依赖上述域名的条目（Chrome 具体版本号与 stable 状态、Gemini Nano 代数、Chrome 平台覆盖率细分、MDN 兼容表）**一律标注「未证实」或「未找到公开数据」**，不以推测填充。
> - 权威度排序：W3C CG 规范 > 官方仓库实现状态文档 > 浏览器厂商 standards-positions 记录 > caniuse 支持表。
>
> **档案性质**：本文件是 [`REVIEW.md`](../REVIEW.md)（2026-09 迭代评审）的**调研底稿**，不是项目运行文档；
> REVIEW 的市场结论与代码级发现均取自本文件与 [`local-ai-market-2026-09.md`](local-ai-market-2026-09.md)。
> 关于「Chrome 内置 AI 的落地状态」，两份底稿的口径不同且**互为补充**：本文件拿到了 **Prompt API 规范**的一手来源
> （§2），而市场那份因官方域名被拦截只标注「未找到公开数据」——两者不矛盾，引用时请以本文件 §2 为准。

---

## 1. WebGPU 浏览器覆盖率与版本状态

### 1.1 全球覆盖率

| 指标 | 数值 | 来源 |
|---|---|---|
| WebGPU 全球使用率 | **85.72%**，加上待生效份额 **+1.63% = 87.35%** | [caniuse.com/webgpu](https://caniuse.com/webgpu)（页面标注数据来源 StatCounter 2026 年 8 月，访问日期 2026-09-27） |

### 1.2 各浏览器支持现状（caniuse 支持表，访问日期 2026-09-27）

来源：[https://caniuse.com/webgpu](https://caniuse.com/webgpu)

| 浏览器 | 状态 | 版本区间 |
|---|---|---|
| **Chrome** | ✅ 已支持 | 113–143、144–153、154、155–157（即 **Chrome 113 起默认开启**，一直延续到 157） |
| **Edge** | ✅ 已支持 | 113–151、152（**Edge 113 起默认开启**） |
| **Safari（桌面）** | ◐ **部分支持** | 17.4–18.7「Disabled by default」；**26.0–26.6、27、27.1–TP 为 Partial support** |
| **Firefox（桌面）** | ❌ 仍默认关闭 | 141–144、145–155、156、**157–159 均为「Disabled by default」** |
| Opera | ✅ 已支持 | 99–134、135 |
| **Chrome for Android** | ✅ 已支持 | 152 |
| **Safari on iOS** | ✅ 已支持 | 17.4–18.7 默认关闭；**26.0–26.6、27.0、27.1–27.2 为 Supported（完整支持）** |
| **Firefox for Android** | ❌ 默认关闭 | 156 |
| Samsung Internet | ✅ 已支持 | 24–29、30 |
| Android Browser | ❌ 不支持 | 152 |
| QQ / Baidu / UC / KaiOS | ❌ 不支持或默认关闭 | — |

### 1.3 需要注意的三点

1. **桌面 Safari 是「部分支持」而 iOS Safari 是「支持」** —— 同一 WebKit 引擎在 caniuse 上被标为不同等级。具体缺失哪些子特性，caniuse 支持表未在页面上列出 → **未证实**。
2. **Firefox 至今（157–159）仍默认关闭 WebGPU**。caniuse 把 Firefox 的历史区间切成 63–140 / 141–144 / 145–155 / 156 / 157–159 五段且全部为「Disabled by default」——分段本身暗示期间有变更，但**变更内容未证实**。
3. **caniuse 未提供「按设备的 WebGPU 实际可用率」**（只给浏览器版本支持 + 全局使用率份额）。若需要「支持 WebGPU 且硬件达标」的真实占比，需要额外数据源 → **未找到公开数据**。

### 1.4 与 caniuse 互证的官方来源

- W3C WebGPU 规范：[W3C Working Draft](https://gpuweb.github.io/gpuweb/)（caniuse 标注为 **WD**）。
- 实现状态追踪：[gpuweb/gpuweb Wiki — Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)（caniuse 页面「Resources」区链接）。
- Chrome 113 首发 WebGPU 的官方公告：caniuse 未直接引用，且 `developer.chrome.com` 被拦截 → **本次未能核验原始公告 URL，未证实**。
- **State of WebGPU 报告：未找到公开数据**（未检索到该名称的一手报告 URL）。

---

## 2. 浏览器内置 AI（Prompt API / Gemini Nano）

### 2.1 规范状态：Prompt API 已把「工具调用」写进规范（关键发现）

来源：[webmachinelearning/prompt-api — README（Explainer）](https://github.com/webmachinelearning/prompt-api/blob/main/README.md)（访问日期 2026-09-27）

- **原生工具调用已进入 API 设计**：`LanguageModel.create({ tools: [...] })`，每个 tool 由 `name` / `description` / `inputSchema` / `execute` 组成。模型决定调用时，由 user agent 调用对应的 `execute()` 并把结果回灌模型，**模型无关（model-agnostic）**。
- **并发工具调用是明确警告项**：文档原文指出模型「可能并发多次调用」同一工具（示例中一次 prompt 可能触发 3 次 `getWeather`），内部等价 `Promise.all()`，等全部结果返回后才生成最终答复。
- **工具调用需在 expected 类型中声明**：示例中 `expectedInputs` 含 `{ type: "tool-response" }`、`expectedOutputs` 含 `{ type: "tool-call" }`。

### 2.2 `availability()` 取值

来源同上（访问日期 2026-09-27）。`LanguageModel.availability(options)` 返回以下四值之一：

| 取值 | 含义 |
|---|---|
| `"unavailable"` | 实现不支持所请求的选项，或根本不支持提示语言模型 |
| `"downloadable"` | 支持所请求选项，但需先下载（模型本身或微调）才能创建会话 |
| `"downloading"` | 支持，但需等待进行中的下载完成 |
| `"available"` | 无需任何新下载即可支持 |

`availability()` 可接收 `expectedInputs` / `expectedOutputs` / `thinking` 等选项做**前置能力探测**。

### 2.3 推理（thinking）档位

来源同上（访问日期 2026-09-27）：

- `thinking: { effort, includeThoughts }`，`effort` 允许 `"none"`（默认）/ `"low"` / `"medium"` / `"high"`。
- `includeThoughts: true` 时，`prompt()` / `promptStreaming()` 返回结构化 `{ type, value }` 块，`type` 为 `"thought"` 或 `"text"`。
- UA 自行把 effort 档位映射为底层模型的推理预算；中间思考在每轮结束后从历史中剥离，**不会永久累积进 `session.contextUsage`**。

### 2.4 多语言（支持语言）

来源同上（访问日期 2026-09-27）：

- 通过 `create()` 的 `expectedInputs` / `expectedOutputs` **按类型分别指定语言**：
  `{ type: "text", languages: ["en","ja"] }`、`{ type: "image", languages: ["fr"] }`、`{ type: "audio" }`（省略 `languages` 表示按基础模型能力尽力而为）。
- 作用：触发必要的支持材料下载（微调、安全模型），或在语言不被支持时**让 `create()` 快速失败**。
- 语言不影响模型实际看到的上下文，也不强制输出语言，仅是「期望声明」。
- 默认（不声明语言）时实现使用基础能力，遇到不支持的语言可能抛 `NotSupportedError`。
- **具体「支持语言清单」由 UA 决定，规范不枚举** → 想知道 Chrome 实际支持哪些语言，需查 Chrome 文档（被拦截）→ **未找到公开数据（本会话）**。

### 2.5 可靠性与宿主限制

来源同上（访问日期 2026-09-27）：

- **结构化输出**：`responseConstraint` 接受 JSON Schema 对象或 `RegExp`；不支持的特性抛 `NotSupportedError`；无法产出符合约束的结果抛 `SyntaxError`。
- **会话管理**：`clone()`；`destroy()` 可让 UA 从内存卸载模型；`contextUsage` / `contextWindow` / `measureContextUsage()`；`contextoverflow` 事件；溢出时按「一轮问答」为单位丢弃最早历史，但 `initialPrompts` **永不丢弃**；极端情况抛新的 `QuotaExceededError`（带 `requested` 与 `context window` 属性，见 [whatwg/webidl#1465](https://github.com/whatwg/webidl/pull/1465)）。
- **下载进度**：`monitor(m)` + `downloadprogress` 事件，`e.loaded` 为 0–1，`e.total` 恒为 1 —— **不暴露总字节数**；至少触发 `loaded===0` 与 `loaded===1` 两次事件。
- **不暴露 tokenizer**：官方明确不向开发者暴露真实分词，以免依赖模型细节。
- **多模态输入**支持 image / audio；**多模态输出不支持**（`expectedOutputs` 中非 `"text"` 一律失败）。
- **宿主限制（对架构影响最大）**：仅 **top-level `Window` + 同源 iframe**；跨源 iframe 需 `allow="language-model"`；**规范明确「目前不在 Worker 中可用」**（原因是难以确定 worker 的 responsible document 以检查权限策略）。

### 2.6 官方 non-goals（原文两条）

来源：[prompt-api README](https://github.com/webmachinelearning/prompt-api/blob/main/README.md)（访问日期 2026-09-27）

1. **不打算强制每个浏览器都内置或暴露语言模型**；尤其「并非所有设备都能存储或运行模型」。**「始终返回 no language model available」是合规实现**；甚至**完全用云端服务实现该 API 也是可行的**。
2. **不打算保证语言模型的质量、稳定性或跨浏览器互操作**；尤其无法保证这些 API 暴露的模型在任一场景下表现良好 —— 这属于实现质量问题（类比 shape detection API）。

另有两条「尚未确定的潜在目标」（当前刻意未定）：是否允许开发者**知道或控制**推理在端侧还是云端完成；是否允许开发者**获知模型标识**以便白名单/黑名单特定模型。官方指出这两点都可能带来互操作挑战 —— **这正是「无法可靠判断用户是否真的在用端侧模型」的规范级原因**。

### 2.7 实现状态与厂商立场

| 项目 | 状态 | 来源 |
|---|---|---|
| **Chrome** | 实验性实现 Prompt API；stakeholder 一栏写 **"Chromium: prototyping behind a flag"** | [prompt-api README](https://github.com/webmachinelearning/prompt-api/blob/main/README.md)（2026-09-27） |
| **Edge** | 实验性实现 Prompt API（README 首段点名 Microsoft Edge，指向 `learn.microsoft.com/.../prompt-api`） | 同上 |
| **WebKit / Safari** | **`position: oppose`（反对）**。Issue「ML Prompt API」2025-05-14 创建、**2026-05-27 关闭**；标签：`position: oppose`、`concerns: interoperability`、`concerns: privacy`、`concerns: portability`、`from: Google` | [WebKit/standards-positions#495](https://github.com/WebKit/standards-positions/issues/495) |
| **Mozilla / Firefox** | **`position: negative`（负面）**。Issue #1213 于 2025-04-28 创建、**2026-05-05 关闭**；标签：`position: negative`、`concerns: interoperability`、`venue: W3C CG`；反应计数 **-1 共 139** | [mozilla/standards-positions#1213](https://github.com/mozilla/standards-positions/issues/1213) |
| **Apple Foundation Models framework 是否对网页开放** | **未找到公开数据**。仅可核验的反证：Prompt API 提案者（domenic）在 WebKit issue 正文中写「Chromium 即将启动 Origin Trial，很想知道该 API 是否易于与 **Apple Intelligence** 或其他 WebKit 浏览器配合」，而 WebKit 的结论是 oppose。未检索到任何 Web API 形态的 Foundation Models 网页接口 | [WebKit/standards-positions#495](https://github.com/WebKit/standards-positions/issues/495) |

### 2.8 明确未证实 / 未找到的条目

- **Chrome 内置 AI 在 2026 年是否已 stable**：**未证实**。规范侧只能确认「prototyping behind a flag」，无法核验 2026 年是否已转正（`developer.chrome.com`、`chromestatus.com` 均被拦截）。
- **Gemini Nano 是第几代（Nano 2 / 3 / 4）**：**未找到公开数据**。Prompt API 规范刻意不暴露模型标识或版本。
- **Windows / macOS / Linux / Android 的平台覆盖矩阵**：**未找到公开数据**（该信息集中在被拦截的 Chrome 官方文档中）。
- **Translation / Summarizer / Writer / Rewriter / Proofreader 各 API 的 stable 状态与支持语言数**：**本次未完成核验**。可用的下一步一手来源为 [translation-api](https://github.com/webmachinelearning/translation-api)、[writing-assistance-apis](https://github.com/webmachinelearning/writing-assistance-apis)、[proofreader-api](https://github.com/webmachinelearning/proofreader-api) 三个仓库的 README。

---

## 3. WebLLM / MLC 生态

### 3.1 版本与发布节奏（一手，已验证）

| 项 | 值 | 来源 |
|---|---|---|
| **最新版本** | **`@mlc-ai/web-llm` v0.2.85**，发布 **2026-09-08** | [GitHub Release v0.2.85](https://github.com/mlc-ai/web-llm/releases/tag/v0.2.85)；npm 亦为 0.2.85 | 
| 包体积 | unpackedSize ≈ 13.9 MB（不含模型权重） | [registry.npmjs.org/@mlc-ai/web-llm/latest](https://registry.npmjs.org/@mlc-ai/web-llm/latest) |
| v0.2.83 | 2026-04-24：跨源存储支持、模型产物完整性校验、subgroup wasm gating | [Release v0.2.83](https://github.com/mlc-ai/web-llm/releases/tag/v0.2.83) |
| v0.2.82 | 2026-03-13 | [Release v0.2.82](https://github.com/mlc-ai/web-llm/releases/tag/v0.2.82) |
| v0.2.81 | 2026-02-18：**Engine/MLCEngine 大重构**、多模型加载、OpenAI API 对齐（**function calling + embeddings**）、统一对话模板、XGrammar 结构化生成、IndexedDB 缓存 | [Release v0.2.81](https://github.com/mlc-ai/web-llm/releases/tag/v0.2.81) |

**v0.2.85（2026-09-08）变更要点**：新增 **OPFS 同步访问句柄与 committed cache records**；升级内置 TVM web runtime 至 `0.27.0-dev0`；Service Worker 重启后仍能接收请求；保留恢复后的 worker 模型状态以避免重复加载；修复无效 structural-tag 约束导致的挂起；拒绝 NaN 生成参数。**该版本沿用既有 `v0_2_84/base` 模型库，不需要新的模型二进制。**

> 发布节奏观察：v0.2.82（3 月）、v0.2.83（4 月）之后，**v0.2.84 → v0.2.85 之间相隔约 4.5 个月（4 月至 9 月）**。仓库仍活跃，但模型目录更新（而非引擎更新）在 2026 年下半年明显放缓。

### 3.2 function calling / tool_choice 状态：**至今仍标注 WIP**

来源：[web-llm README](https://github.com/mlc-ai/web-llm/blob/main/README.md)（访问日期 2026-09-27）

- README 原文（**截至 2026-09-27 仍未修改**）：
  > "you can use the same OpenAI API on any open source models locally, with functionalities including streaming, JSON-mode, function-calling **(WIP)**, etc."
- 同文「Full OpenAI Compatibility」一节：
  > "[function-calling](examples/function-calling) **(WIP)**: function calling with fields `tools` and `tool_choice` (**with preliminary support**); or manual function calling without `tools` or `tool_choice` (keeps the most flexibility)."
- **结论**：`tools` + `tool_choice` 属**初步支持（preliminary support）**，官方仍标 WIP，**尚未 GA**。生产环境若依赖工具调用，官方建议的稳妥路径是**手写 prompt 的 manual function calling**（不依赖 `tools`/`tool_choice`）。**
- 相关能力：WebLLM 支持 **XGrammar 结构化生成**（JSON-schema / grammar 约束），v0.2.81 起引入 structural tag，并有「tool calls via structural tag」示例 —— 这是工具调用的**替代实现路径**。

### 3.3 模型目录：README 列出的家族明显滞后

来源：[web-llm README](https://github.com/mlc-ai/web-llm/blob/main/README.md)（访问日期 2026-09-27）。README「Built-in Models」原文列出的主家族为：

- **Llama**: Llama 3, Llama 2, Hermes-2-Pro-Llama-3
- **Phi**: Phi 3, Phi 2, Phi 1.5
- **Gemma**: **Gemma-2B**
- **Mistral**: Mistral-7B-v0.3, Hermes-2-Pro-Mistral-7B, NeuralHermes-2.5-Mistral-7B, OpenHermes-2.5-Mistral-7B
- **Qwen**: **Qwen2 0.5B / 1.5B / 7B**

**关键判断**：
- README 的家族清单**未出现 Qwen3、Qwen3.5、Llama 3.2、Gemma 2/3、Phi-3.5**。但 **v0.2.81 的 release notes 明确写了「expanded prebuilt model support: ... Llama 2/3/3.1/3.2, Mistral variants, Gemma 2, Qwen2/2.5/3, Phi family, including vision」** —— 即 **release notes 声称支持 Qwen3 与视觉模型，而 README 未同步更新**。
- 因此 README 的家族列表**不可作为最新的模型可用性依据**；权威清单在源码 [`src/config.ts` 的 `prebuiltAppConfig.model_list`](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts)。**本次未能逐条核验该清单中的实际 model id**（未抓取 `src/config.ts`）→ **「Qwen3 系列 / ≤3B 工具调用友好档位」的精确清单：本次未完成核验，标注未证实。**
- 已知可确定的是：**存在 ≤3B 档位**，如 README 中的 **Qwen2 0.5B / 1.5B**、**Gemma-2B**、**Phi 3** 家族，以及示例中反复出现的 **`Llama-3.2-1B-Instruct-q4f16_1-MLC`**（见 README 的 Integrity Verification 示例）。

### 3.4 多模态支持

- **视觉（vision）**：v0.2.81 release notes 明确写 "including **vision**"，覆盖 Phi family 等 → **有视觉模型支持**（[Release v0.2.81](https://github.com/mlc-ai/web-llm/releases/tag/v0.2.81)，2026-02-18）。
- **语音 / TTS**：**未找到公开数据**（README 与已核验的 release notes 均未提及 TTS 或语音输入）。

### 3.5 ServiceWorkerMLCEngine 与离线能力（含官方警告）

来源：[web-llm README](https://github.com/mlc-ai/web-llm/blob/main/README.md)（访问日期 2026-09-27）

- 用途：把推理放进 Service Worker，**避免每次访问页面都重新加载模型**，改善离线体验。
- **官方明确警告**：Service Worker 生命周期由浏览器管理，**可能随时被杀死且不通知 webapp**。`ServiceWorkerMLCEngine` 通过**周期性心跳**尽量保活，但应用必须自己做错误处理；相关配置项为 `keepAliveMs` 与 `missedHeartbeat`。
- **v0.2.85 修复了一个真实坑**：必须在 worker 脚本**顶层**实例化 handler，**不要在 `activate` 或 `message` 监听器里实例化** —— 因为浏览器可以在不再次派发 `activate` 事件的情况下重启一个已 active 的 worker。（v0.2.85 release note：「Register service-worker handlers during startup so restarted workers can receive requests」。）

### 3.6 缓存后端：四种可选（含一个关键约束）

来源：[web-llm README](https://github.com/mlc-ai/web-llm/blob/main/README.md)（访问日期 2026-09-27）。`AppConfig.cacheBackend` 取值：

| 取值 | 说明 |
|---|---|
| `"cache"` | 浏览器 **Cache API**（**默认**） |
| `"indexeddb"` | IndexedDB |
| `"opfs"` | Origin Private File System；无 OPFS 支持的环境会**直接报 OPFS availability 错误**；`opfsAccessMode` 可选 `"auto"`（用同步访问句柄）/ `"sync"`（强制要求）/ 默认 `"async"` |
| `"cross-origin"` | **实验性** Chrome Cross-Origin Storage API 扩展后端，**需用户安装浏览器扩展**；未安装则自动回落默认 cache；**不支持程序化删除 tensor cache**（清理由扩展管理） |

其他可靠性能力：**SRI（Subresource Integrity）哈希校验**模型产物（config / wasm / tokenizer），失败可 `"error"` 抛 `IntegrityError` 或 `"warn"` 仅告警。

### 3.7 同层竞品

> **本节为本次调研的覆盖缺口**：因 `web_search` 不可用且剩余抓取预算用于核验上述一手来源，**Transformers.js（v3/v4）、MediaPipe LLM Inference / LiteRT-LM、wllama、ONNX Runtime GenAI、WebNN API 的 2026 年状态均未完成核验**。以下仅为可直接查证的下一步 URL，**不含任何未经核验的版本号**：

- Transformers.js：[registry.npmjs.org/@huggingface/transformers/latest](https://registry.npmjs.org/@huggingface/transformers/latest)、[GitHub releases](https://github.com/huggingface/transformers.js/releases)
- onnxruntime-web：[registry.npmjs.org/onnxruntime-web/latest](https://registry.npmjs.org/onnxruntime-web/latest)
- ONNX Runtime GenAI：[github.com/microsoft/onnxruntime-genai](https://github.com/microsoft/onnxruntime-genai)
- wllama：[registry.npmjs.org/@wllama/wllama/latest](https://registry.npmjs.org/@wllama/wllama/latest)、[github.com/ngxson/wllama](https://github.com/ngxson/wllama)
- MediaPipe / LiteRT-LM：[github.com/google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe)、[github.com/google-ai-edge/LiteRT-LM](https://github.com/google-ai-edge/LiteRT-LM)
- WebNN API：[github.com/webmachinelearning/webnn](https://github.com/webmachinelearning/webnn)（README / commits）

**→ 竞品对比一节：未找到公开数据（本次未核验）。**

---

## 4. WebMCP / 浏览器 agent 接口标准

### 4.1 规范状态（一手，权威度最高）

| 项 | 值 | 来源 |
|---|---|---|
| 文档类型 | **W3C Web Machine Learning Community Group — Draft Community Group Report** | [webmachinelearning.github.io/webmcp](https://webmachinelearning.github.io/webmcp/) |
| **版本日期** | **2026 年 9 月 26 日** | 同上 |
| 标准地位 | **明确声明：不是 W3C Standard，也不在 W3C Standards Track** | 同上 |
| 编辑者 | Brandon Walderman（Microsoft）、Khushal Sagar（Google）、Dominic Farolino（Google） | 同上 |
| 首次发布 | **2025 年 8 月 13 日** | [webmcp README](https://github.com/webmachinelearning/webmcp/blob/main/README.md) |

### 4.2 API 形态：是 `document.modelContext`，**不是** `navigator.modelContext`

来源：[WebMCP 规范](https://webmachinelearning.github.io/webmcp/)（2026-09-26）

- `Document` 扩展：`[SecureContext, SameObject] readonly attribute ModelContext modelContext;`
- 方法：`registerTool(tool, options)`（含 `signal` 与 `exposedTo`）、`getTools(options)`（含 `fromOrigins`）、`executeTool(tool, args, options)`（含 `signal`）。
- 事件：`toolchange`、`toolactivated`（`ToolActivatedEvent`）、`toolcancel`（`ToolCancelEvent`）。
- 权限策略集成：`tools` 特性；跨源 iframe 需 `allow="tools"`，`registerTool()` 失败时 reject 一个 `NotAllowedError` DOMException。
- 结构化结果：tool 的 `execute` 返回的 JS 值被**序列化为 JSON 字符串**回传；输入参数反序列化失败直接 fail。
- 注解（annotations）：`readOnlyHint` / `untrustedContentHint` / `consequentialHint` / `debugging`。
- 生命周期语义要点：注销工具**不会取消**已开始的执行；`registerTool` 的 signal 只控制工具可用性，执行期 `signal` 才控制单次调用生命周期；工具名长度 1–128，仅允许 ASCII 字母数字、`_`、`-`、`.`。

> **对既有代码的直接影响**：若你早期按 `navigator.modelContext` 写过适配层，需要迁移到 `document.modelContext`。

### 4.3 Origin Trial 时间线与浏览器实现状态（一手）

来源：[webmcp/implementation-status.md](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md)（访问日期 2026-09-27）

| 浏览器 / Agent | 状态 | 原文 / 细节 |
|---|---|---|
| **Chrome** | **Origin Trial 已上线，Chrome 149** | "An Origin Trial is live in **Chrome 149**"；本地开发开 `about:flags#enable-webmcp-testing`；属 **Early Preview Program**；有 Blink Intent to Experiment 与 Chrome Status 条目 |
| **Edge** | **Origin Trial 已上线，Edge 150** | "An Origin Trial is live in **Edge 150**"；平台支持参照 Chrome |
| **Brave** | 实验性支持，加在 **Leo AI chat** 中 | 引用 brave-browser issue 55232 |
| **ChatGPT Desktop** | **已支持** | "WebMCP is supported in ChatGPT Desktop" |
| **Firefox** | 仅立场讨论中 | [mozilla/standards-positions#1412](https://github.com/mozilla/standards-positions/issues/1412)、[Bugzilla 2018306](https://bugzilla.mozilla.org/show_bug.cgi?id=2018306) |
| **Safari** | 仅立场讨论中 | [WebKit/standards-positions#670](https://github.com/WebKit/standards-positions/issues/670) |

### 4.4 两引擎对 WebMCP 的实际立场（一手标签）

- **Mozilla：`position: neutral`（中立）**。Issue #1412 于 **2026-05-28** 创建，**2026-08-05 关闭**，最后更新 2026-08-26。→ [mozilla/standards-positions#1412](https://github.com/mozilla/standards-positions/issues/1412)
- **WebKit：`position: oppose`（反对）**。Issue #670 于 **2026-05-28** 创建，**2026-06-11 关闭**；标签包含 `position: oppose`、`concerns: duplication`、`concerns: privacy`、`concerns: security`、`concerns: internationalization`、`concerns: portability`、`concerns: API design`、`concerns: use cases`、`concerns: venue`、`topic: meaningful user consent`。→ [WebKit/standards-positions#670](https://github.com/WebKit/standards-positions/issues/670)

**含义**：WebMCP 目前是 **Chromium 系（Chrome/Edge）+ ChatGPT Desktop + Brave** 的推进格局，**Gecko 中立、WebKit 明确反对**。规范本身也声明不在 W3C Standards Track。

### 4.5 规范的设计目标 / Non-Goals（原文）

来源：[webmcp README](https://github.com/webmachinelearning/webmcp/blob/main/README.md)（首次发布 2025-08-13，访问日期 2026-09-27）

**Goals（要点）**：支持 human-in-the-loop 协作；让 agent 通过明确定义的客户端工具而非脆弱的 UI 操作（DOM 抓取、模拟点击）与站点交互；**防止 web 内容被后端集成「去中介化」**；复用页面已有客户端代码；通过 agent 改善可访问性；支持 headless 场景。

**Non-Goals（原文）**：
1. **不面向全自主工作流** —— 该 API 不适用于没有浏览器 UI 的完全自主 agent，它是客户端实现（也可调用服务端 API），纯服务端任务完成没有意义。
2. **不替代后端集成** —— WebMCP 是补充而非替代 MCP 等以后端为中心既有协议。
3. **不替代人类界面** —— 人类 web 界面仍是主要形态，agent 工具是增强而非取代。

**已明确的工程约束（与「工具预算」直接相关，原文）**：模型上下文窗口有限，每个注册工具（名称、描述、input schema）都会消耗 prompt token、增加推理延迟、提升工具混淆或幻觉概率；**暴露过多工具（数十到数百个）会严重降低 agent 性能，或导致 agent 丢弃工具/无法处理**。官方建议：单一职责、按页面状态**动态注册/注销**（用 `AbortSignal`）、简单应用可静态注册、不要在 schema 里做严格约束（严格 schema 校验失败会让 agent 卡住），而应在 `execute` 里详细校验并返回可操作的错误信息、以及**工具执行后必须同步更新可见 UI**。

### 4.6 其他 agent 标准动作

- **Apple / 微软的 agent 标准**：WebMCP 本身由 Microsoft（Brandon Walderman）与 Google 共同编辑，**是微软参与 agent 标准的主要载体**。Apple 侧未检索到对等提案 → **未找到公开数据**。
- **Chrome 的 agentic 相关 API**：除 WebMCP 外，本次未核验到其他 Chrome agentic API → **未找到公开数据**。
- 规范中列出的 Prior Art：**MCP（Anthropic）**、**MCP-B**（开源，浏览器 tab/扩展传输）、**OpenAPI**、**A2A Protocol**。

---

## 5. 关键约束

> **本节覆盖最不完整，明确声明**：Storage Buckets / OPFS / Cache API 配额、移动端内存上限、首次加载体验的量化数据、端侧模型工具调用评测结论 —— **本次均未取得可核查的一手来源**。以下只写能溯源的部分。

### 5.1 存储与缓存（仅 WebLLM 侧的一手事实）

来源：[web-llm README](https://github.com/mlc-ai/web-llm/blob/main/README.md)（访问日期 2026-09-27）

- WebLLM 提供四种缓存后端（`cache` / `indexeddb` / `opfs` / `cross-origin`），默认 **Cache API**。
- **OPFS 的硬约束（可验证）**：在不支持 OPFS 的环境中选择 `"opfs"`，**缓存操作会以 OPFS availability 错误失败**（不是静默降级）。
- **跨源存储的硬约束（可验证）**：`"cross-origin"` 后端**需要用户安装并启用浏览器扩展**；扩展缺失时自动回落默认 cache；**当前不支持程序化删除 tensor cache**，清理由扩展管理。
- **浏览器配额的具体数字规则**（如「磁盘可用空间的比例」「按 origin 计算」「eviction 规则」）：**未找到公开数据（本次未核验）**。可核查方向为 WHATWG Storage 标准与 WICG Storage Buckets 提案。

### 5.2 首次加载体验

- **可溯源的定性事实（官方原文）**：WebLLM README 在 `CreateMLCEngine` 一节明确提示 ——
  > "Note that loading models requires downloading and it can take a significant amount of time for the very first run without caching previously. You should properly handle this asynchronous call."
  来源：[web-llm README](https://github.com/mlc-ai/web-llm/blob/main/README.md)（访问日期 2026-09-27）
- **首次加载耗时的量化数据、各模型的实际下载体积（MB/GB）**：**未找到公开数据**。可核查方向：HuggingFace 上 `mlc-ai/*-MLC` 模型仓库的文件列表。
- **对比参照（规范侧提供的设计动机）**：Prompt API 解释器明确指出，相较于「开发者自带模型」，使用浏览器内置模型的优势是**节省用户的带宽、存储与内存**，且模型已针对设备优化，并让开发者**无需自己托管模型与管理依赖**。来源：[prompt-api README](https://github.com/webmachinelearning/prompt-api/blob/main/README.md)（访问日期 2026-09-27）

### 5.3 移动端内存限制

**未找到公开数据。** 本次未取得 iOS Safari（WebContent 进程 Jetsam 上限）或 Android Chrome 下 WebGPU / WebAssembly 内存上限的一手来源。已知仅有一条规范侧的间接约束：wasm 32 位地址空间本身限制在 4 GB 以内（属通用 WebAssembly 常识，**本次亦未取得可引用的一手 URL**）。

### 5.4 端侧小模型能否胜任工具调用

**未找到公开数据。** 本次未取得 Berkeley Function Calling Leaderboard 或任何可核查的端侧小模型工具调用评测分数。

**但取得了一条来自规范、可直接用于风险判断的一手证据**：Prompt API 与 WebMCP 的规范/最佳实践**都显式把「工具过多导致模型退化」列为已知风险**：
- Prompt API 要求开发者处理**并发工具调用**（模型可能对同一工具并发调用多次）。
- WebMCP 最佳实践明确警告工具数量过多会「严重降低 agent 性能」或让 agent「丢弃工具、无法处理」，并建议**动态注册/注销以控制工具预算**。
- WebMCP 还警告**严格 schema 校验失败会让 agent 卡住**，建议「schema 宽松、代码严格」。

来源：[prompt-api README](https://github.com/webmachinelearning/prompt-api/blob/main/README.md)、[webmcp README](https://github.com/webmachinelearning/webmcp/blob/main/README.md)（访问日期 2026-09-27）

---

## 6. 对「浏览器内本地小模型智能体」项目的 5 条最相关事实

### ① WebLLM 的 function calling 到 2026 年 9 月仍是 WIP —— 不要把工具调用押在 `tools`/`tool_choice` 上

**事实**：v0.2.85（2026-09-08）为最新版，但官方 README 至今仍把 function-calling 标为 `(WIP)`，`tools`/`tool_choice` 仅「preliminary support」，官方推荐的稳妥路径是**手写 prompt 的 manual function calling**。
来源：[web-llm README](https://github.com/mlc-ai/web-llm/blob/main/README.md)、[Release v0.2.85](https://github.com/mlc-ai/web-llm/releases/tag/v0.2.85)

**对选型的影响**：**继续押注 WebLLM 作为"浏览器内智能体"的推理底座是合理的，但不能押注它的原生工具调用协议。** 应自建**与后端无关的工具调用层**（工具描述 → prompt 模板 → 输出解析 → 校验重试），把 `tools`/`tool_choice` 当作「可用则用」的加速路径，而非契约。WebLLM 的 **XGrammar 结构化生成（JSON-schema 约束）** 才是当下更可靠的**约束解码**手段。同时注意仓库模型目录更新自 2026 年 4 月后明显放缓（v0.2.84→0.2.85 相隔约 4.5 个月），且 README 模型家族清单已滞后于 release notes —— **模型选型必须直接读 `src/config.ts` 而非 README**。

### ② Chrome 内置 AI 已把「工具调用」写进规范，且与 WebMCP 是同一套 `tools` 心智模型 —— 双后端值得做，但必须靠 `availability()` 优雅降级

**事实**：Prompt API 规范已有 `LanguageModel.create({ tools })`、`expectedOutputs: [{type:"tool-call"}]`、`thinking.effort`（none/low/medium/high）、`responseConstraint`（JSON Schema/RegExp），`availability()` 返回 `unavailable / downloadable / downloading / available`。Chrome 与 Edge 均已实验性实现。
来源：[prompt-api README](https://github.com/webmachinelearning/prompt-api/blob/main/README.md)（2026-09-27）

**对选型的影响**：**应当做 Prompt API 双后端**，理由是它把「模型下载、量化、内存管理、工具调用循环、结构化输出」全部交给浏览器，开发者侧成本极低，且与 WebMCP 的工具语义同构，一套工具定义可复用到两个后端。**但必须把它当能力增强而非基线**，原因有三：(a) 规范非目标明确允许「永远返回 no model」甚至「纯云端实现」，因此**它不保证端侧**；(b) `availability()` 四值必须显式处理，尤其是 `downloadable`/`downloading` 的首次体验；(c) 存在 **top-level Window + 同源 iframe only、且不支持 Worker** 的宿主限制 —— 你的推理循环若跑在 Worker 里，Prompt API 后端需要主线程代理层。

### ③ WebKit 同时反对 Prompt API 与 WebMCP，Mozilla 对 Prompt API 也是 negative —— 跨浏览器基线只能是 WebGPU 自带模型路线

**事实**：WebKit 对 Prompt API 为 `position: oppose`（2026-05-27 关闭）、对 WebMCP 亦为 `position: oppose`（2026-06-11 关闭，含 duplication/privacy/security/portability 等 9 类顾虑）；Mozilla 对 Prompt API 为 `position: negative`（2026-05-05 关闭，社区 -1 达 139 个），对 WebMCP 为 `neutral`（2026-08-05 关闭）。
来源：[WebKit#495](https://github.com/WebKit/standards-positions/issues/495)、[WebKit#670](https://github.com/WebKit/standards-positions/issues/670)、[mozilla#1213](https://github.com/mozilla/standards-positions/issues/1213)、[mozilla#1412](https://github.com/mozilla/standards-positions/issues/1412)

**对选型的影响**：**Safari 与 Firefox 在可预见期内不会有内置模型 API。** 唯一能覆盖全平台的「浏览器内本地模型」路线仍是 **WebGPU + 自带权重（WebLLM/Transformers.js 类）**。这条事实同时解释了为什么 WebLLM 路线不能放弃：它不是「过渡方案」，而是 **iOS Safari 26+ 已支持 WebGPU**（caniuse 标 iOS Safari 26.0–27.2 为 Supported）之后的**长期主力后端**。注意桌面 Safari 仅「部分支持」，需要运行时能力探测与降级。

### ④ WebMCP 目前是 Chromium 系专有优势，API 已是 `document.modelContext` —— 做集成，但定位为增强路径

**事实**：WebMCP 为 W3C CG Draft（**2026-09-26**），**明确不在 W3C Standards Track**；Chrome 149 与 Edge 150 的 Origin Trial 已上线；Brave Leo 实验性支持、ChatGPT Desktop 已支持；Firefox 中立、Safari 反对。API 载体是 **`document.modelContext`**（非 `navigator.modelContext`）。
来源：[webmcp 规范](https://webmachinelearning.github.io/webmcp/)（2026-09-26）、[implementation-status.md](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md)

**对选型的影响**：**值得做 WebMCP 集成，但只能作为 Chromium 增强路径**（`if (document.modelContext)` 特性探测 + 静默跳过），因为 Origin Trial 阶段 API 仍会变动（规范 9 月仍在改事件接口 —— 2026-09-17 才加入 `ToolActivatedEvent`/`ToolCancelEvent`）。**务必用 `document.modelContext` 而非 `navigator.modelContext`**。另外，WebMCP 与 Prompt API 的 `tools` 语义同构意味着：**一份工具定义 + 两个适配层**是可行的架构，但 WebMCP 的 `execute` 是给**浏览器内建 agent** 用的，你自己的页面内 agent 要用 `getTools()`/`executeTool()` 主动消费 —— 这正好是「页面内本地小模型智能体」调用宿主页面能力的天然接口。

### ⑤ 工具预算与首次加载是端侧 agent 的两个真实天花板 —— 必须按「少而动态」设计，并把下载做成显式流程

**事实**：WebMCP 最佳实践原文警告工具数量过多会「严重降低 agent 性能」或让 agent「丢弃工具、无法处理」，建议动态注册/注销；并警告严格 schema 校验失败会让 agent 卡住。Prompt API 则要求处理**同一工具被并发调用多次**。首次加载方面，WebLLM 官方原文提示「首次无缓存运行时下载可能耗时很长」，且 Prompt API 的 `downloadprogress` **不暴露总字节数**（`total` 恒为 1）。存储侧可验证的硬约束是：OPFS 不可用时选 `"opfs"` 会直接报错、跨源存储后端需用户装扩展且不支持程序化清理 tensor cache。
来源：[webmcp README](https://github.com/webmachinelearning/webmcp/blob/main/README.md)、[prompt-api README](https://github.com/webmachinelearning/prompt-api/blob/main/README.md)、[web-llm README](https://github.com/mlc-ai/web-llm/blob/main/README.md)（均 2026-09-27）

**对选型的影响**：**(a) 工具面要按「少而动态」设计** —— 常驻工具控制在个位数，其余按页面状态用 `AbortSignal` 注册/注销；`inputSchema` 写宽松（只给模型提示），严格校验放在 `execute` 内并返回可操作的错误信息让模型自纠；**(b) 必须实现并发工具调用**（模型可能同时调同一工具多次），用 `Promise.all` 语义而非串行队列。**(c) 首次加载要作为显式产品流程**：缓存后端优先 `opfs`（v0.2.85 刚加了 OPFS 同步句柄，是官方在优化的方向），但必须做 OPFS 能力探测再回退 `cache`；跨源存储需引导用户装扩展，不装则接受默认缓存；Prompt API 侧只能用 `loaded` 百分比做进度条（拿不到字节数），建议在 UI 上避免承诺「还需 X MB」。**(d) 明确的能力缺口**：本次**未找到**端侧小模型工具调用能力的公开评测数据，也**未找到**移动端内存上限与浏览器存储配额的一手规则 —— **这意味着「本地小模型能否稳定完成多步工具调用」在你的目标设备上仍是未验证假设，应在项目早期用真机（尤其低端 Android 与 iOS）做实测，而不是依赖公开评测**。

---

## 附录：本次未能核验的条目汇总

| 条目 | 状态 | 原因 |
|---|---|---|
| Chrome 内置 AI 是否 stable、具体版本号 | 未证实 | `developer.chrome.com`、`chromestatus.com` 被拦截 |
| Gemini Nano 代数（Nano 2/3/4） | 未找到公开数据 | 规范刻意不暴露模型标识 |
| Chrome 内置 AI 的 Windows/macOS/Linux/Android 覆盖矩阵 | 未找到公开数据 | 同上 |
| Gemini Nano 官方支持语言清单 | 未找到公开数据 | 规范不枚举，实际清单在 Chrome 文档 |
| Translation/Summarizer/Writer/Rewriter/Proofreader 各 API 的 stable 状态 | 未完成核验 | 抓取预算分配给了 Prompt API 主体 |
| WebLLM `prebuiltAppConfig.model_list` 精确 model id 清单（含 Qwen3、≤3B 档位） | 未完成核验 | 需读 `src/config.ts` |
| WebLLM 语音 / TTS 支持 | 未找到公开数据 | README 与 release notes 未提及 |
| 端侧小模型功能调用评测（BFCL 等） | 未找到公开数据 | 未取得可核查来源 |
| 浏览器存储配额具体规则（Storage Buckets / OPFS / Cache API） | 未找到公开数据 | 未取得一手来源 |
| 移动端内存上限（iOS Jetsam / Android） | 未找到公开数据 | 未取得一手来源 |
| 各模型实际下载体积（MB/GB） | 未找到公开数据 | 需 HuggingFace 文件列表求和 |
| State of WebGPU 覆盖率报告 | 未找到公开数据 | 未检索到该名称的一手报告 |
| Transformers.js / MediaPipe / LiteRT-LM / wllama / ONNX Runtime GenAI / WebNN 状态 | 未找到公开数据（本次未核验） | 抓取预算与 `web_search` 缺失 |

**若需补齐**：优先恢复 `web_search`（配置 API key）或放开对 `developer.chrome.com`、`chromestatus.com`、`developer.mozilla.org`、`huggingface.co` 的网络访问；`raw.githubusercontent.com`、`api.github.com`、`registry.npmjs.org`、`webmachinelearning.github.io`、`caniuse.com` 本次均可正常抓取。
