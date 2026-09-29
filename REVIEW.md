# 迭代评审：本地智能体 × 2026-09 市场情况

> 评审时间：2026-09-27 · 评审基线：`39b4636 chore: 接入 ESLint 并统一聊天组件`
> 方法：通读 `src/`（12 文件）+ `server/` + `public/` + `tests/` + CI + 4 份文档，逐行核对项目实际依赖的
> SDK（`node_modules/@missionsquad/browserai@0.1.0`，内含 `@mlc-ai/web-llm@0.2.84` /
> `@huggingface/transformers@4.2.0`）的真实能力，并用一手来源核实市场事实。
> 标注约定：**【已核实】**= 有可打开的一手来源或代码行号；**【待实测】**= 逻辑推断，需真机验证。

---

## 0. 一句话结论

工程完成度显著高于同赛道练习作品（301 条单测、零 lint 告警、三协议解析器、上下文预算、多上游代理），
但**它当前只在"手搓一个 agent 循环"这条路上优化，而没有吃满自己选定的 SDK——后者已经提供了 47 个模型、
推理 worker、OPFS 缓存、多模态、语音流水线**。市场侧的信号同样明确：浏览器内跑模型的**可行性问题已经解决**
（WebGPU 覆盖 85.7%），**竞争点转移到了 agent 能力密度**（工具调用的可靠性、与被 agent 化的网页协议对接、
多模态入口），而纯离线的价值主张正在被"本地优先 + 云兜底"的商业化重新定义。

因此本轮迭代的主轴建议是：**先修 3 项"宣称与实现不符"的必修项（A1 双重缓存 / A5 推荐接线 / A8 文档一致性，
约 2–3 小时），其余 6 项按"先测量"处理——在没有实测数据前不改造；再把工程量投到"只有纯浏览器本地 agent
才能做、且市场正在起量的能力"上：多模态 / 语音入口 + WebMCP 工具消费 + 工具调用可靠性。**
全文 12 条代码级发现、4 个批次的建议清单与 9 项待验证风险见下。

---

## 1. 市场情况（事实、来源与含义）

### 1.1 底座：WebGPU 已过临界点，但并非"全覆盖"

| 事实 | 来源 |
| --- | --- |
| WebGPU 全球可用率 **85.72%**（+1.63% 前缀，合计 87.35%），数据基准 2026-08 StatCounter | [caniuse.com/webgpu](https://caniuse.com/webgpu) |
| Chrome 113–157 ✅、Edge 113–152 ✅、Opera 99+ ✅、Chrome for Android 152 ✅ | 同上 |
| **Safari 26.0–27.2 为 partial**，iOS Safari 26.0+ ✅（iPadOS/macOS 同源） | 同上 |
| **Firefox 157–159 仍 disabled by default**，Firefox for Android 同样未开 | 同上 |

含义：
- README「已知限制」写的"覆盖约 85.7%、Safari 26 起支持、Firefox 仍为 flag"**与 2026-08 数据一致**，
  这条不需要改；但要注意 Safari 是 **partial**（`shader-f16`、存储配额、`maxStorageBufferBindingSize`
  等限制在 Safari 上更早触顶），因此"设备自适应"不能只看 `navigator.hardwareConcurrency`。
- 约 **14% 的流量池（主要是 Firefox + 旧 Safari/企业锁定浏览器）永远进不来**。项目对此的策略是"不排期"，
  这在"技术作品"定位下可以接受，但**它必须是一个被明说的、有数字的取舍**，而不是被读者自己发现。

### 1.2 运行时生态：押注 WebLLM 仍然成立，但"原生 function calling"依然不能等

| 事实 | 来源 |
| --- | --- |
| WebLLM 官方 README 仍将 function calling 标为 **(WIP)**：`tools` / `tool_choice` 为 "preliminary support"，或"manual function calling without tools/tool_choice" | [mlc-ai/web-llm README](https://raw.githubusercontent.com/mlc-ai/web-llm/main/README.md) |
| WebLLM 已支持 **SRI（`integrity`）校验**：对 `config` / `model_lib` / `tokenizer` 做 sha256/sha384/sha512 校验，失败抛 `IntegrityError`（或 `onFailure:"warn"`） | 同上 |
| WebLLM `cacheBackend` 四选：`cache` / `indexeddb` / `opfs` / **`cross-origin`**（Chrome Cross-Origin Storage 扩展，可跨站点共享权重） | 同上 |
| WebLLM 提供 `WebWorkerMLCEngine` 与 `ServiceWorkerMLCEngine`（内含心跳 `keepAliveMs` / `missedHeartbeat` 语义） | 同上 |
| Transformers.js 最新版 **4.3.0**（项目内置 4.2.0），onnxruntime-web 1.31-dev | [registry.npmjs.org](https://registry.npmjs.org/@huggingface/transformers/latest) |
| `mlc-ai/web-llm` 仓库 19,195 star，2026-09-15 仍有提交（活跃） | `api.github.com/repos/mlc-ai/web-llm` |
| WebLLM 最新版 **0.2.85**（2026-09-08）：新增 OPFS 同步访问句柄与 committed cache records、TVM web runtime → 0.27.0-dev0、Service Worker 重启后仍能收到请求。**项目经 SDK 间接依赖的是 0.2.84** | [releases/tag/v0.2.85](https://github.com/mlc-ai/web-llm/releases/tag/v0.2.85) |
| WebLLM 的 `functionCallingModelIds` 白名单**只有 5 个 7B/8B Hermes 档，≤4B 一条都没有** | WebLLM `src/config.ts`（0.2.85） |
| WebLLM 依赖 `@mlc-ai/web-xgrammar@0.1.27`——约束解码是真实机制，但**官方未文档化其支持的 JSON Schema 子集边界**（项目的 `buildDecisionSchema` 只敢用基础子集，判断正确） | WebLLM `package.json`（0.2.85） |

含义：
- 项目自建三种工具协议（`react` / `native` / `json` 约束解码）**不是重复造轮子，而是当前唯一可行路径**——
  上游 function calling 依然 WIP。这条技术路线应继续，且 ROADMAP「不等原生 tools」的决策**继续有效**。
- 但上游**新交付的三件事项目都没用**：SRI（对应 ROADMAP 的 P2-3，现在可直接落地）、OPFS / cross-origin
  缓存后端（项目硬编码 `indexeddb`）、worker 引擎（项目在主线程推理）。这三项都是"改配置就能拿到"的收益。

### 1.3 标准侧：WebMCP 进入 Origin Trial，"页面向 agent 暴露工具"开始有真实接口

| 事实 | 来源 |
| --- | --- |
| WebMCP：Chrome **149** Origin Trial 已上线、Edge **150** Origin Trial 已上线；本地开发可用 `about:flags#enable-webmcp-testing` | [webmcp/implementation-status.md](https://raw.githubusercontent.com/webmachinelearning/webmcp/main/implementation-status.md) |
| **ChatGPT Desktop 已支持 WebMCP**；Brave 在 Leo 中做实验性支持；Firefox / Safari 目前只有 standards-position，无实现 | 同上 |
| API 形态：`document.modelContext.registerTool() / getTools() / executeTool()`，支持 `toolchange` 事件、`exposedTo` 跨源白名单、iframe 的 `allow="tools"` 权限策略 | [webmcp README](https://raw.githubusercontent.com/webmachinelearning/webmcp/main/README.md) |
| 官方最佳实践明确警告**工具预算**："每个注册工具都消耗上下文 token、增加延迟、提高工具混淆/幻觉概率"；并要求**严格在代码里校验、宽松在 schema 里约束**，错误信息要可自愈重试 | 同上 |
| Service Worker 提供工具（后台发现）仍在 explainer 阶段 | 同上 |
| **引擎立场**：WebKit 对 WebMCP 投 `position: oppose`（#670，2026-06-11 关闭）；Mozilla 为 `position: neutral`（#1412，2026-08-05 关闭） | [WebKit#670](https://github.com/WebKit/standards-positions/issues/670)、[Mozilla#1412](https://github.com/mozilla/standards-positions/issues/1412) |
| 规范性质：W3C Web ML CG **Draft Community Group Report（2026-09-26）**，显式声明不是 W3C Standard、不在 Standards Track；API 名为 **`document.modelContext`**（早期文档里的 `navigator.modelContext` 已废弃） | [webmachinelearning.github.io/webmcp](https://webmachinelearning.github.io/webmcp/) |

含义（**本项目最被低估的机会**）：
- 项目现有的 `read_page_content` 走的是"读 DOM 文本 → 4000 字符塞进上下文"这条路——这正是 WebMCP 想替掉的
  "brittle UI actuation"。而 WebMCP 的**消费者侧（agent 端）恰恰是它让给社区的部分**：浏览器内置 agent 之外，
  需要有人用**页面内运行的模型**去 `getTools()` → 转 OpenAI tools 格式 → `executeTool()`。
- 项目已经具备全部前置件：`toolSchemas.getOpenAIToolsFormat()`（工具→schema）、`agentLoop` 的三协议解析、
  `validateToolInput()`（结构校验）。**接 WebMCP 只需要一个"工具源适配器"**，是技术密度/性价比最高的一项。
- 因为仍是 Origin Trial，必须做**特性检测 + 降级**（`document.modelContext` 不存在时回落到现有 6 个内置工具）。

### 1.4 赛道量级与商业化走向：基础设施在赢，纯离线在退

| 事实 | 来源 |
| --- | --- |
| Ollama **181,786 star**，官方自述**服务 890 万开发者**；2026-07 融资 **$88M** | `api.github.com/repos/ollama/ollama`、[ollama.com/blog](https://ollama.com/blog/all-aboard-open-models) |
| Ollama 2026-08-31 起改为按 token 计费（Pro $20 / Max $100 / Team $500），**本地跑模型永久不限量** | [ollama.com/pricing](https://ollama.com/pricing) |
| LM Studio **桌面应用闭源**（GitHub 仅 CLI/SDK），2026 年推 Bionic 云（$20/$100 每月）+ Bionic Agent + Skills | [lmstudio.ai/pricing](https://lmstudio.ai/pricing) |
| Open WebUI **153,283 star**（2026-09-26 活跃）、AnythingLLM 66,509、Cherry Studio 52,166、Jan 44,663 | `api.github.com/repos/*` |
| **GPT4All 77,378 star 但 `pushed_at` 停在 2025-05-27**（事实停更 16 个月） | 同上 |
| MCP 规范 **2026-07-28** 版：协议无状态化（去掉 initialize 握手与 session id）、Roots/Sampling/Logging 弃用（12 个月宽限）、Tasks 移出核心；Tier-1 SDK 月下载近 **5 亿** | [blog.modelcontextprotocol.io](https://blog.modelcontextprotocol.io/posts/2026-07-28/) |
| MCP Registry 仍为 **preview**（官方明示可能有破坏性变更） | [modelcontextprotocol.io/registry/about](https://modelcontextprotocol.io/registry/about) |
| 消费者 AI 支出约 **$400 亿**，美国成年人采用率 61%→64% | [Menlo Ventures](https://menlovc.com/perspective/) |

含义：
- "本地推理"已经是**基础设施级能力**（Ollama 890 万开发者、MCP SDK 月下载 5 亿），继续论证"能不能在本地跑"
  已经没有信息量。
- 但**头部产品的商业化都转向了云**（Ollama 按 token 计费、LM Studio 卖 Bionic 云、Merlin 20M+ 用户纯云端）。
  纯离线的剩余价值集中在：**合规/内网/断网场景**、**零边际成本**、**数据不出端的信任叙事**。
- GPT4All 的"高人气 + 停更"是对本赛道最直接的警号：**只做"本地聊天壳"的窗口已经关闭**；
  能活下来的是工具链（Ollama/Open WebUI）、协议（MCP）和真正有差异化能力的应用。

### 1.5 模型侧：Qwen3.5 的真实档位与官方 agent 分数（直接决定档位策略）

| 事实 | 来源 |
| --- | --- |
| Qwen3.5 一代真实档位是 **0.8B / 2B / 4B / 9B**（2026-03-02 发布，**Apache-2.0**，全系 pipeline 为 image-text-to-text）；`0.6B / 1.7B / 8B` 属于上一代 Qwen3 | [QwenLM/Qwen3.5 README](https://raw.githubusercontent.com/QwenLM/Qwen3.5/main/README.md)、HF 模型 API |
| 官方模型卡明确写 **"Agentic Usage — Qwen3.5 excels in tool calling capabilities"** 并给出自测分 | [Qwen/Qwen3.5-2B 模型卡](https://hf-mirror.com/Qwen/Qwen3.5-2B/raw/main/README.md) |
| **BFCL-V4：2B = 43.6 / 0.8B = 25.3**（对照基线 Qwen3-4B-2507 = 39.9） | 同上 |
| **TAU2-Bench（多轮真实 agent 任务）：2B = 48.8 / 0.8B = 11.6** | 同上 |
| MLC 量化权重齐备：`mlc-ai/Qwen3.5-{0.8B,2B,4B,9B}-{q4f16_1,q4f32_1}-MLC`；`vram_required_MB` = **1629 / 2245 / 3868 / 6433**（q4f16_1） | WebLLM `src/config.ts`（0.2.85） |
| 第三方口径的 sub-2B 工具调用横评（**厂商自测**，BFCLv3）：Granite 4.0-1B **52.43** > LFM2.5-1.2B **49.12** > Qwen3-1.7B **46.30** > Llama-3.2-1B **21.44** > Gemma 3 1B IT **16.64** | [LiquidAI/LFM2.5-1.2B-Instruct 模型卡](https://hf-mirror.com/LiquidAI/LFM2.5-1.2B-Instruct/raw/main/README.md) |
| 浏览器向量库：Orama 仍活跃（npm `@orama/orama` **3.1.18**，仓库 2026-09-11 有 push）；Voy 旧仓库路径已 404（无官方停更声明） | npm registry、GitHub API |

三条直接影响档位策略的结论：

1. **默认推荐 2B 是正确的，而且现在有硬数据背书**：0.8B 的 BFCL-V4 只有 2B 的 58%，在 TAU2（多轮真实任务）
   上只有 **24%**（11.6 vs 48.8）。也就是说 **0.8B 档在 agent 场景基本不可用**，而它当前的描述
   （`description: "速度优先，能力受限，适合老旧设备（最低显存兜底）"`）并未把这一点讲清楚。
   → 建议把它重新定位为"**纯对话/信息抽取档，不承诺工具调用**"，并在 UI 下拉里写明。
2. **"参数量不是工具调用能力的可靠指标"有据可查**（同为 ~1B 级，52.43 与 16.64 差 3 倍以上），
   但 **"1.7B 附近存在能力谷"未获任何一手来源证实** → ROADMAP 中据此的推论应降级为"待验证"，
   不要让未证实的结论驱动推荐算法。
3. **9B 确实存在且 MLC 权重齐备**（VRAM 6433MB ≈ 6.4GB），但**不在 SDK 的 `MODEL_PRESETS` 里**——
   见 §2.2 #9 的修正。

### 1.6 浏览器内置 AI：规范已把"原生工具调用"写进 API，但两大引擎明确反对

| 事实 | 来源 |
| --- | --- |
| Prompt API 规范定义 `LanguageModel.create({ tools: [...] })`：每个 tool 含 `name` / `description` / `inputSchema` / `execute`，**由 UA 自动执行并把结果回灌模型**（model-agnostic）；规范同时提示**模型可能并发调用同一工具多次** | [prompt-api README](https://github.com/webmachinelearning/prompt-api/blob/main/README.md) |
| `availability()` 四值：`unavailable / downloadable / downloading / available`（可传 `expectedInputs` / `expectedOutputs` 做前置能力探测） | 同上 |
| 支持 `responseConstraint`（JSON Schema **或** RegExp 结构化输出）、`thinking.effort`（none/low/medium/high）、`contextUsage` / `contextWindow` / `measureContextUsage()` / `contextoverflow` 事件；下载进度 `downloadprogress` **不暴露总字节** | 同上 |
| **不支持多模态输出**；多模态输入支持 image / audio；**仅 top-level Window 与同源 iframe**（跨源 iframe 需 `allow="language-model"`）；**规范明确"目前不在 Worker 中可用"** | 同上 |
| 官方 non-goals：不保证每个浏览器都提供模型（"永远返回 no model available"是合规实现）、允许**纯云端实现**；不保证质量、稳定性与**跨浏览器互操作** | 同上 |
| **WebKit 对 Prompt API 投 `position: oppose`**（#495，2026-05-27 关闭）；**Mozilla 为 `position: negative`**（#1213，2026-05-05 关闭，社区 -1 达 139） | [WebKit#495](https://github.com/WebKit/standards-positions/issues/495)、[Mozilla#1213](https://github.com/mozilla/standards-positions/issues/1213) |
| Chrome 与 Edge 均已实验性实现（规范仓库点名两端），但**具体版本 / stable 状态 / 平台覆盖未能从一手官方页面核验**——`developer.chrome.com`、`chromestatus.com`、`developer.mozilla.org` 在本环境被网络策略拦截 | 缺口声明，见 §5 |

含义（**这一节修正了我最初"暂缓双后端"的判断**）：

- **双后端的价值比原判断更高**：Prompt API 规范里的 `tools` + `responseConstraint` 恰好是项目自建的
  `getOpenAIToolsFormat()` + `buildDecisionSchema()` 试图解决的问题，而且由浏览器原生保证。
- **但跨浏览器基线只能是"自带 WebGPU 模型"这条**（WebKit 同时 oppose Prompt API 与 WebMCP、
  Mozilla 对前者 negative）。所以正确形态不是"二选一"，而是**能力探测 + 优雅降级**：
  `availability() === "available"` 时用内置模型跑（零下载、秒开），否则回落自带模型。
- **一个必须提前知道的架构冲突**：Prompt API **不在 Worker 中可用**，而 §3-A3 建议把 WebLLM 推进 Worker。
  两条路径线程模型不同 → 适配层必须把"线程模型"作为后端能力的一部分抽象，而不是事后补丁。

### 1.7 对项目定位的三条含义

1. **不要再去证明"模型能在浏览器跑"**——README 的验收表格（进度条 0→100%、控制台输出"模型已就绪"）是
   2024 年的叙事。市场已经把这一层商品化了。**新的叙事应该是"浏览器里的 agent 能可靠地做成事"**。
2. **"离线"要作为合规/隐私叙事来讲，而不是省钱叙事**：Ollama 的定价已经证明"本地免费"是获客手段而非商业模式。
   项目作为技术作品，应把"零上传 + 可离线 + 可内网发行"讲成**可信度**（配合 SRI 校验），而不是"省 API 费"。
3. **对接标准比自研协议更值钱，但要限定为 Chromium 增强路径**：WebMCP 处于 OT 且**消费者侧空白**
   （WebKit `oppose`、Mozilla `neutral`），MCP 侧已有生态但需要服务端。一个"用浏览器内本地模型驱动
   WebMCP 页面工具"的演示，既是技术密度展示，也正好落在市场空档上——但**它只能是增强路径，不能成为
   默认能力**，且要正视规范自带的两个约束：**工具预算（少而动态）**与**模型可能并发调用工具**。

---

## 2. 项目现状评估

### 2.1 明确高于同类作品的部分（应保持）

- **解析器容错**：`parseReActOutput` 五级降级（thinking 剥离 → `<tool_call>` XML → JSON 块 → 标准 Action 行 →
  内联调用）+ 全角标点归一 + 死循环保护（同工具第 2 次注入引导、第 3 次终止）。这是小模型 agent 最难的 20%。
- **上下文预算显式化**：`contextBudget.js` 把 system / observation / history / memory 四类预算写死并单测。
- **代理工程质量**：`dev-proxy.mjs` 多上游 fallback（hf-mirror → hf-api.cn；jsdelivr → jsdmirror → ghproxy）、
  仅网络错误重试（5xx 切上游）、失败响应强制 `no-store`（避免 SW 缓存住 502）、`PROXY_TOKEN` 门禁。
- **工程门禁**：CI 跑 lint(`--max-warnings=0`)+单测+覆盖率+build 存在性校验；`pre-commit` hook。

### 2.2 与 SDK 能力逐条对照后的发现

> 说明：以下每条都在本地代码与 `node_modules/@missionsquad/browserai@0.1.0` 中可复核。
> 优先级按"用户可感知的影响 ÷ 改动成本"排序。

| # | 级别 | 发现 | 依据 | 影响 |
| --- | --- | --- | --- | --- |
| 1 | **P0** | **模型权重被存两份**：SW 对 `/hf/*` `/hf-transformers/*` `/gh-raw/*` 做 cache-first 写入 Cache API（`local-agent-models-v2`），同时 SDK 的 `cacheBackend:"indexeddb"` 把同一批产物写进 IndexedDB（`webllm/model`、`webllm/config`、`webllm/wasm`） | `public/sw.js:34-41,140-142`；`src/embed.js:116`；SDK `model-cache.js:4-8` | 首次加载后**磁盘占用约翻倍**（2B 档 ~1.2GB → ~2.4GB）；更糟的是 `deleteModelArtifacts()` 只清 SDK 侧（`embed.js:486-488`），SW 缓存仍在 → ROADMAP P0-4「点击清理后占用数值下降」的验收**会部分失效** |
| 2 | **待测量** | **对话在用"信息抽取"参数集**：SDK 每个 preset 的 `defaultRuntime` 来自 `extractionPreset()`（`temperature: 0`、`topP: 0.85`、`repetitionPenalty: 1.08`、`frequencyPenalty: 0.2`、**`seed: 42`**）；`embed.js` 明确"不传 runtime，让 SDK 用 preset 默认" | `src/embed.js:303-306`；SDK `models.js:74-86,148,164,180` | 事实成立（对话确实跑在 temperature=0 + 固定 seed 下），但**"回答呆板"的严重程度未实测**；且"决策步低温、回答步高温"这一常见方案在现有架构下做不到（模型在同一次生成里自行决定输出 Action 还是 Final，调用前无法预知哪一步是最后一步）。**建议先做 1 行级微调**（`temperature` 0.2~0.5、`seed: null`，保留对小模型有益的 `repetitionPenalty` / `frequencyPenalty`），再用 `getStats()` 对比工具调用失败率 |
| 3 | **待测量** | **推理跑在主线程**：`new BrowserAI({...})` 只传了 `webllm.logLevel`，未传 `webllm.worker` | `src/embed.js:112-118`；SDK `config.d.ts:7-14` | 事实成立、官方也建议放进 worker，但**卡顿幅度未量化**；而 `dist-embed` 是"整目录部署 + 宿主 `<script>` 引入"的形态，加 worker 会多出一个必须被宿主正确解析路径的 chunk——该项目曾出现过"嵌入产物完全无法加载"的回归，属同类风险。**未测出明显卡顿前不建议动**，若要做必须在 `demo/embed-demo.html` 与 `dist-embed` 产物上双重验证 |
| 4 | **P1**（文案级） | **4B 档显存门槛写错**：`MODEL_OPTIONS` 写 `minVRAMGB: 6`，SDK 权威值 **3867.82 MB** | `src/modelLoader.js:48-57`；SDK `models.js:171-176` | 该字段**当前不参与任何判定**（`recommendModelId` 只看 tier 与核心数），所以影响面仅限下拉文案与 README 表格的误导——**修正它必须与 #5 同做才会产生实际效果**（README 已同步为 3.9GB 并注明该字段不参与判定） |
| 5 | **P0** | **"设备自适应推荐"整条链在主页面是断的**：① `recommendModelId` 先按 tier 找 `recommended: true`，而只有 2B 带该标记 → **永远返回 2B**（8 核 / 16GB 机器同样）；② 更关键：主页面 `main.js` **从未消费 `model-recommended` 事件**——下拉初始值被设为最低档（`getDefaultModelId()` → 0.8B），而「加载模型」读取的正是下拉当前值，`ready()` 算出的推荐档只发了个事件就没人接 | `src/modelLoader.js:97-123`；`src/main.js:56-62,146`；`src/embed.js:164-170`；SDK `hardware.d.ts:3-17` | **用户首次使用实际加载的是 0.8B**（TAU2-Bench 11.6，而 2B 是 48.8），直接表现为"这个 agent 很笨"，与 README / USAGE 宣称的"自动推荐 2B"不符。推荐逻辑也没用 SDK 已给的 `deviceMemoryGB` / `limits` / `vramRequiredMB`。修复只需在 `main.js` 消费事件并写回下拉（数行），但影响是用户拿到的档位 |
| 6 | **待测量** | **上下文窗口没被利用**：`LoadOptions.contextLength` 可覆盖（默认 4096，可到 32768），项目没传；而 native 协议的 system prompt 实测 2663 字符（预算 3200） | SDK `client.d.ts:51-57`；`ROADMAP.md` 风险登记 | 调大窗口确实比缩提示词直接，但**前提是上下文真的溢出了**——项目尚无这方面的失败数据。**更值得先核实的线索**：MLC 的 Qwen3.5 条目带 `max_history_size: 1`，若其语义是"KV cache 只保留最近 1 轮"，则 `MAX_HISTORY_MESSAGES = 8` 本来就进不去模型，那才是"聊着聊着忘了要求"的真因（该字段语义未查到权威说明，**待核实**） |
| 7 | **P1** | **每步重算 prefill**：`generateText` 默认 `resetChat !== false → engine.resetChat(false)`，而 ReAct 每步都把完整 `messages` 重发 | SDK `inference.js:22-23`；`src/agentLoop.js:543-547,654-668` | 多步工具调用时第 2..N 步要重新 prefill 整个 system+历史；`resetChat: false` 配合"消息前缀递增"可复用 KV（**待实测**） |
| 8 | **P1** | **下拉未按 SDK 目录过滤**：`main.js` 用 `getModelOptions()` 渲染，而 `embed.js` 已提供 `getAvailableModels()` | `src/main.js:56-62`；`src/embed.js:214-216` | README 声称"页面下拉与 load() 均按实际目录过滤"——**下拉其实没过滤**，只是 load() 兜底降级，用户可能选中一个会静默换档的选项 |
| 9 | **P1** | **ROADMAP P1-4（新增 Qwen3.5-9B 档）不能按原计划做**：9B 的 MLC 权重确实存在（`mlc-ai/Qwen3.5-9B-q4f16_1-MLC`，VRAM **6433MB**），但**不在 SDK 的 `MODEL_PRESETS` 里**（SDK 只有 0.8B/2B/4B），而 `getAvailableModelOptions()` 会把目录外的 id 全部过滤掉 | SDK `models.js:137-185,1035-1052`；`src/modelLoader.js:143-148`；WebLLM `src/config.ts` | 按原计划"补元数据"会被过滤成空、静默回落到全部档位；要做 9B 必须走 `CUSTOM_MODEL_RECORDS` / `withCustomModelRecords` 路线（自带 model + model_lib URL 并过代理），且 6.4GB 显存门槛意味着目标设备很少 |
| 10 | **P2**（文档，已修正） | **文档漂移 4 处**：① `INTEGRATION.md` 构造参数表缺 `serviceWorker` / `swPath` / `swScope`；② 该文件曾写"修改 `register("/sw.js")` 为实际路径"（代码早已支持 `swPath`）；③ `USAGE.md` 曾写"已内置 3 次重试（每次 500ms）"，而代码是 `PER_UPSTREAM_RETRIES = 1`（1 次重试 + 300ms + 多上游 fallback）；④ `ROADMAP.md` 的 P0-3 曾标未完成但代码已实现 | 见左列行号 | 与实现不符的表述会直接误导使用者（尤其构造参数表缺项会让宿主漏配 `serviceWorker: false`）。本报告已同步修正以上位置，另修正了 `netlify.toml` 的 gh-raw 规则描述与 `INTEGRATION.md` 的两处错误陈述（"无全局污染"、"无 GPU 会降级软件渲染"） |
| 11 | **P2** | **与 SDK 重复实现**：`stripThinking`（SDK 有 `stripThinkTags`）、`getStats`/`failureLog`（SDK 有 `RunHistoryStore` + `logRun` + `latencyBreakdown` 逐 token 遥测） | `src/agentLoop.js:206`；SDK `index.d.ts:35-37,46` | 不算错，但 SDK 那份含**每 token 延迟分解**与按模型聚合，自己维护版缺这块；可择机把"遥测"交给 SDK，"失败归因"留给自己 |
| 12 | **P2** | **环境未声明**：`package.json` 无 `engines`，README 说 Node 20+，但 vite 7 要求 `^20.19.0 \|\| >=22.12.0`；本机 Node **16.14.1** 下 `npm test` 直接崩（`node:fs/promises` 无 `constants` 导出） | `package.json`；`node_modules/vite/package.json` | 新机器/评审者第一次跑就失败；CI 的 `node-version: "20"` 会拿到 20.x 最新（碰巧能过），掩盖了这个问题 |

### 2.3 尚未动用、但已经"躺在依赖里"的能力（SDK 目录实测）

SDK 自带 **47 个 preset**，项目只用了 3 个（Qwen3.5 0.8B/2B/4B）。以下都在目录内、无需新增依赖：

- **低配档**：`LiquidAI/LFM2.5-230M / 350M / 1.2B-Thinking`（ONNX）、`granite-4.0-350m/1b/micro`、
  `Falcon-H1-Tiny-90M`、`MiniCPM5-1B`、`SmolLM3-3B` → 直接对应 ROADMAP「低配置体验档」，
  且能绕开"Qwen 档位 447MB 起步"的门槛问题。
  **工具调用维度还有一组可用的参照**（厂商自测 BFCLv3）：Granite 4.0-1B **52.43**、LFM2.5-1.2B **49.12**，
  均高于 Qwen3-1.7B（46.30），而 Gemma 3 1B IT 只有 **16.64** —— 说明"选哪个小模型"比"选多大的模型"更关键。
  **代价：这些档位非国内开源，与 `modelLoader.js` 顶部"只列国内开源"的策略冲突，需要显式改策略并说明理由**
  （可表述为"agent 能力优先于下载链路偏好"，同时保留 Qwen 档为默认）。
- **多模态**：`SmolVLM-256M/500M`、`Qwen3-VL-2B`、`Qwen2.5-VL-3B`、`GLM-OCR`、`LightOnOCR-2` + `describeImage()`。
- **语音**：`Whisper Base/Tiny/Medium`、`Moonshine`、`Parakeet CTC 0.6B`、`Kokoro-82M`（**流式**）、
  `Supertonic 1/2`，加上现成的 `VoicePipeline`（按键说话、barge-in、句级流式播报）。
- **能力槽位**：text / vision / stt / tts 各一个，**最多 4 个模型同时驻留**——即"看图 + 说话 + 回答"可以共存。
- **语言**：`RunHistoryStore`（localStorage 运行日志）、`parseJsonFromModel` / `validateAgainstJsonSchema`
  （模型输出 JSON 的二道校验）、`buildExtractionMessages`、`collectHardwareSnapshot` / `modelSafetyHint`。
- **存储**：`getCachedModelStatus` / `estimateOriginStorage` / OPFS / cross-origin 后端。

> **注意**：SDK **不提供 embedding / feature-extraction**（`index.d.ts` 无相关导出）。ROADMAP 第 4 批的
> 浏览器内 RAG 若要落地，需自行把 `@huggingface/transformers`（SDK 的依赖，可提升为直接依赖）拉进来做
> `feature-extraction`，并注意它的向量后端与 `dist-embed` 体积（Transformers.js chunk 实测 **60.9MB**，见批次 B 的说明）。

---

## 3. 迭代建议

### 批次 A · 必修三项（约 2–3 小时，无新增依赖）

> **分级依据**：必修 = 修复"项目自己**宣称过**、但实际没做到"的能力（磁盘清理承诺 / 设备自适应 / 文档一致性）；
> 其余按"先测量"处理，避免在没有实测数据时去优化不存在的问题。

| 项 | 做法 | 理由 | 验收 |
| --- | --- | --- | --- |
| **A1** 消除双重模型缓存（最该做的一条） | 二选一：①**（推荐）** `public/sw.js` 不再拦截模型路径（`isModelRequest` 直接 return，交回网络与 SDK），模型缓存唯一交给 SDK 的 `cacheBackend`；②保留 SW，但 `deleteModelArtifacts()` 里一并 `caches.delete("local-agent-models-v2")` 并在 UI/README 说明存在两层缓存 | 全篇唯一确定属于"缺陷"而非"优化"的一条：SW 那份副本**永远不会被读取**（SDK 缓存命中后不再发 fetch），用户却永久多付一倍磁盘，且"清理缓存"的承诺随之失真 | 首次加载 2B 档后 `navigator.storage.estimate()` 的 usage 约减半；点清理后回落到加载前量级（需在 DevTools → Application 对比两处占用） |
| **A5** 接通"设备自适应推荐" | ① `main.js` 消费 `model-recommended` 事件并写回下拉——**现成实现可直接照抄** `demo/embed-demo.html:141-147`（数行）；② `recommendModelId(snapshot)` 引入 `snapshot.deviceMemoryGB` / `limits` 与 preset 的 `vramRequiredMB`，替换只看 core 数的阈值 | 这条链在**主页面**是断的：下拉初始为最低档 0.8B，加载用下拉值，而推荐事件无人消费 → **用户首次拿到的是 0.8B 而不是 2B**（TAU2-Bench 11.6 vs 48.8）。注意另外两个页面的行为**是对的**（`demo` 消费了事件、`search.html` 直接 `agent.load()` 走推荐档），说明问题只在 `main.js` 这一处接线，修复成本极低 | 新增单测覆盖 5 组硬件快照（无 GPU / 2 核 / 4 核 8GB / 8 核 16GB / 16 核 32GB）；页面上首次进入时下拉等于推荐档 |
| **A8** 文档与 ROADMAP 同步 | **已完成**：见 §2.2 #10 的修正清单；`package.json` 已加 `engines`（`^20.19.0 \|\| >=22.12.0`）、已补 `.nvmrc`（22） | 文档是这类作品被评审时的主要阅读面，1 行 ×N 的成本换掉一批"读者会踩的坑" | `npm run lint` 全绿；`grep -n 'register("/sw.js")' INTEGRATION.md` 无结果；Node 版本不符时 `npm test` 报的是清晰的 engines 提示而非语法崩溃 |
| A4 修正 4B 档显存门槛（**须与 A5 同做**） | `MODEL_OPTIONS` 的 `minVRAMGB: 6 → 3.9`（README 已改，代码待改） | 与 SDK 权威元数据（3867.82 MB）对齐。**单独做收益为 0**——该字段目前不参与任何判定，只有在 A5 引入 `vramRequiredMB` 判断后才会产生行为差异 | 既有"档位 ⊆ SDK 目录"单测仍绿；4GB 显存机器出现 4B 推荐 |
| A9 重新定位 0.8B 档（文案） | 改 `description` 为"纯对话/抽取档，工具调用能力有限（BFCL-V4 25.3 vs 2B 43.6；TAU2 11.6 vs 48.8）"（README 已改，代码待改） | 有官方自测数据支撑；避免低端机用户把"档位弱"误判成"agent 笨" | 文案更新；当设备只够 0.8B 时 UI 给出能力提示 |

### 批次 A′ · 先测量

> 这三项的理由（回答呆板 / 卡顿 / 上下文溢出）**都缺少实测证据**，属于从代码推断出的假设。
> 在无 WebGPU、且 Node 版本不达标（跑不了测试）的环境下改造它们，很可能是在优化不存在的问题。

| 项 | 测量方式 | 决定点 |
| --- | --- | --- |
| A2 采样参数 | 先把 runtime 微调为 `temperature: 0.2~0.5`、`seed: null`（保留 `repetitionPenalty` / `frequencyPenalty`），连问 3 次同一问题 | 若回答措辞有变化且 `getStats().toolFailures` 不升高则保留；否则回到抽取预设 |
| A3 推理进 Worker | 生成时用 Performance 面板观察 long task（是否 >50ms 且频繁）与输入延迟 | 若确有明显卡顿再做，并在 `dist-embed` 产物 + `demo/embed-demo.html` 双重验证 |
| A6 上下文窗口 | ① **优先**查清 MLC `max_history_size: 1` 的语义；② 用长对话看 `failureLog` 是否有 context 相关失败 | 若历史本就进不去模型，问题不在窗口大小，而在历史注入方式 |
| ~~A7 下拉改用可用档位~~ | 当前 3 档全在 SDK 目录内 → **收益为 0** | 等真的新增目录外档位（如自定义 ModelRecord）时再做 |

### 批次 B · 多模态与语音（SDK 现成能力，预计 2–3 人日）

| 项 | 做法 | 理由 |
| --- | --- | --- |
| B1 截图问答 | 接入 `SmolVLM-256M/500M` 或 `Qwen3-VL-2B`，新工具 `describe_page_region`（截取当前可视区域或某个 selector 的截图 → VLM 描述） | 补掉 `read_page_content` 的结构性盲区：**图表、验证码位置、布局错乱、图片内容**都不是文本能覆盖的。且"页面理解"是浏览器内 agent 唯一的独占优势（云端方案要上传截图） |
| B2 语音提问 / 朗读回答 | 接 `VoicePipeline`（Whisper Base + Qwen3.5 + Kokoro 82M 流式），或最小化只做 `transcribe` + `synthesize` 两个按钮 | 语音是最能体现"端侧 + 低延迟 + 无上传"的演示形态；SDK 已经把 mic → STT → LLM → TTS 串好，含 barge-in 与句级流式，自研成本几乎为零 |
| B3 能力槽位可视化 | UI 显示当前驻留的模型（text/vision/stt/tts）与显存估算 | 4 个槽位共存是这套 SDK 的结构性特点，把它显性化能直接体现"技术密度" |

> **决策依据（实测）**：多模态与语音档位**全部走 Transformers.js 后端**，因此必须上传 `dist-embed/transformers.web-*.js`（实测 **60.9MB**，gzip 16.9MB），
> 方式二的部署体积会从"仅 WebLLM 时的约 6MB"涨到 **67MB**。
> 但代价只落在"宿主无构建工具、只能用单文件产物"这一种接入方式上：方式一（npm 源码复用）由宿主自行打包，
> 不受影响；且多模态是纯浏览器 agent 相对云端方案**唯一无法被替代**的能力（截图不出端）。
> **建议：接受该代价并启动本批**，同时在 UI 上用"按需加载 + 占用提示"控制首次体验（ROADMAP 第 5 批已同步该结论）。

### 批次 C · Agent 能力密度（差异化核心，预计 3–5 人日）

| 项 | 做法 | 理由 |
| --- | --- | --- |
| C1 **WebMCP 工具消费适配器** | 新增 `src/webmcpTools.js`：特性检测 **`document.modelContext`**（不是 `navigator.modelContext`）→ `getTools()` → 映射为项目工具表（`name`/`description`/`inputSchema` 直接复用现有 `toolSchemas` 管线）→ 执行走 `executeTool()`；监听 `toolchange` **动态增删工具**（遵守官方"工具预算：少而动态"原则，只暴露与当前页/当前问题相关的少数几个） | 市场空档 + 项目已有 80% 前置件；且它把项目从"读 DOM 的 agent"升级为"与网页协作的 agent"。Chrome 149 / Edge 150 已是 Origin Trial，**现在做正好卡在窗口期**。必须做降级：无 `modelContext` 时保持现有 6 个工具（WebKit `oppose`、Mozilla `neutral`，不能当基线） |
| C1b WebMCP 的安全闸门 | 用规范给的 `annotations`（`readOnlyHint` / `untrustedContentHint` / `consequentialHint`）区分只读与副作用工具；对带副作用的工具加**显式用户确认**；页面工具的返回值一律按不可信内容处理（复用 `budgetObservation` 的注入标注） | 一旦本地模型能通过页面工具**改变网页状态**（下单、改文档），风险等级就从"读"变成"写"。官方最佳实践同样要求 human-in-the-loop；这是这类项目**唯一可能造成真实损失**的地方。验收：单测验证 `consequentialHint: true` 的工具在无确认时不得被执行，且注入样例（页面工具返回"忽略之前的指令…"）不改变最终回答的语义 |
| C2 **工具调用可靠性三件套** | ①参数校验失败时自动重试一次（把校验错误 + 正确示例一起回灌，现在只回灌错误）；②`json` 约束解码**按步启用**（决策步用 schema，回答步自由文本）；③解析器支持**一次输出多个 tool_call 时顺序执行**（现在是取最后一个） | 这三条都直接打在小模型 agent 的痛点上；其中 ③ 还顺手抹掉了"不支持并行/多工具"的短板（ROADMAP 计划只"声明不支持"，但**顺序执行多个工具**是低风险可达的） |
| C3 搜索工具重做 | 按 ROADMAP 方案接自建 SearXNG（经 `dev-proxy` 同源转发），保留 Wikipedia 兜底 | 现有 DuckDuckGo **Instant Answer** 只返回摘要/相关主题，经常为空 —— 这是"agent 看起来笨"的一个高频来源，比换模型更划算 |
| C4 对话摘要压缩 | 超过 N 轮后，用模型把更早的历史压成一段摘要存进记忆，取代"只保留最近 8 条" | 现在 `MAX_HISTORY_MESSAGES = 8` + 每条 500 字符，长任务会静默丢早期约束，表现为"聊着聊着忘了要求" |

### 批次 D · 可信度与长期项（可选）

| 项 | 做法 | 理由 |
| --- | --- | --- |
| D1 权重 SRI 校验 | 用 `withCustomModelRecords` 给 3 个 Qwen3.5 档补 `integrity`（sha256），`onFailure: "warn"` 起步 | 上游已支持，是回应"第三方镜像供应链风险"（项目自己 README 已声明该风险）最直接的手段；ROADMAP P2-3 可就此结项 |
| D2 OPFS / cross-origin 缓存 | `cacheBackend: "opfs"`（或提供开关）；文档写明 cross-origin 需装扩展 | 缓解 IndexedDB 大文件性能与配额问题；cross-origin 后端可让**多站点共享同一份权重**，对"嵌入到多个宿主站"的场景是质变 |
| D3 离线/内网发行包 | 静态托管权重 + `modelSource: "direct"` 指向内网 + SRI 校验 | 对应 1.4 节判断：纯离线的真实价值在合规/内网，不在省钱 |
| D4 评测基线 | 固定 20 条工具调用用例（含难例：需多步、需拒绝调用、参数缺失、诱导注入），把成功率/平均步数/TTFT 记成表，随版本回归 | 项目现在有 `getStats()` 和 301 条单测，但**没有"agent 效果"的回归基线**——A2/C2 这类改动的收益无法证明，也无法防止回退 |
| D5 Prompt API 适配层（能力探测 + 降级） | 抽象出后端接口 `{ available(), chat(messages, {tools}) }`：`availability() === "available"` 时走 `LanguageModel.create({ tools, responseConstraint })`，否则回落自带 WebGPU 模型 | 规范已把原生 `tools` + `responseConstraint` 写进 API（见 §1.6），恰好覆盖项目自建的两块能力，且零下载、秒开——对"第一次打开页面"的体验是质变。**约束**：仅 Chromium 系，不能作基线；**不在 Worker 中可用**（与 A3 线程模型冲突，需在抽象层体现）；不支持多模态输出 |

---

## 4. 建议明确不做 / 暂缓

- **P2-1 双后端：可做，排在 D5**。依据：Prompt API 规范已把 `tools` 与 `responseConstraint` 写进 API 设计（见 §1.6）。
  但仍不建议打进主路径——WebKit `oppose` + Mozilla `negative` 意味着它永远只是 **Chromium 增强路径**，而且
  **它不在 Worker 中可用**，与 A3 的线程模型相冲突。正确顺序：先把自带模型这条路的 A1–A9 修完，
  再以"能力探测 + 优雅降级"的形态接入。
- **暂不追 9B 档**：9B 的 MLC 权重确实存在（VRAM 6.4GB），但不在 SDK 目录内，需要自定义 ModelRecord +
  自建权重托管，且 6.4GB 显存门槛把绝大多数设备排除在外。在 4B 都还没被推荐逻辑正确启用（A4/A5）之前
  加 9B，属于"优化一个没人能用到的档位"。**把这份工程量投到 B1/B2 与 C1 更划算。**
- **不做 npm 发布 / CHANGELOG / Dependabot**：维持既有决策（定位为技术作品）。
- **不为 MPA 做 DOM 层兼容**：但值得在 README 里补一句"WebLLM 的 `ServiceWorkerMLCEngine` 是正确路径，
  本 SDK 尚未暴露"——把上游依赖写清楚，比留白好。
- **不追 9B 档**：见上条（并入同一条结论，避免重复表述）。

---

## 5. 风险、不确定性与待验证项

| 项 | 性质 | 建议的验证方式 |
| --- | --- | --- |
| 双重缓存导致占用翻倍（§2.2 #1） | **逻辑推断**（两处缓存键与写入路径均已核对） | DevTools → Application → Storage 对比 `local-agent-models-v2` 与 `webllm/model` 的占用字节数 |
| `resetChat: false` 能复用 KV 从而加速多步循环（§2.2 #7） | 推断，依赖 WebLLM 的消息前缀 diff 行为 | 同一问题在两种设置下对比 `getStats().avgTotalMs` |
| contextLength 上调到 8192 的显存代价 | 未测 | 在 4B 档看 `probeHardware` 的 limits 与实测是否 OOM |
| **MLC `max_history_size: 1` 的语义**（Qwen3.5 各档的 overrides 都带该字段） | **未查到权威说明**——若其含义是"KV cache 只保留最近 1 轮"，则 `MAX_HISTORY_MESSAGES = 8` 本就进不去模型，这才是"聊着聊着忘了要求"的真因，且优先级高于 A6 | 查 WebLLM/MLC 源码或文档；或用一次带明显早期信息的对话做黑盒验证 |
| WebMCP 的稳定性与跨引擎性 | Origin Trial（Chrome 149 / Edge 150）；**WebKit `oppose`（#670）、Mozilla `neutral`（#1412）**；规范为 W3C CG Draft，不在 Standards Track | 必须特性检测 + 降级；不要在默认路径上依赖它；用 `document.modelContext` 而非 `navigator.modelContext` |
| Prompt API 的版本与平台覆盖 | **规范一手来源已取得**（`tools` / `responseConstraint` / `availability()` 均已写入），但 **Chrome/Edge 的具体版本、stable 状态、Windows/macOS/Linux/Android 覆盖未能核验**（官方域被网络策略拦截） | 落地 D5 前需人工在可访问网络复核；实现上只依赖 `availability()`，不假设版本 |
| Qwen3.5 的 agent 分数（BFCL-V4 43.6/25.3、TAU2 48.8/11.6） | **厂商自测**（来自官方模型卡），非第三方榜单复现 | 用 D4 的本地评测基线在自己的用例上复核，再据此改档位策略 |
| sub-2B 工具调用横评（Granite 4.0-1B 52.43 … Gemma 3 1B 16.64） | **厂商自测**（Liquid 模型卡，口径含自定义 handler），且 BFCL 官方榜单的动态表体本次未取到逐行分数 | 不要直接引用为排名结论；换档前用 D4 基线实测 |
| "1.7B 附近存在工具调用能力谷" | **未获任何一手来源证实**（ROADMAP 中据此的推论应降级为待验证） | 若要用它驱动推荐算法，先做本地实测 |
| 本地/端侧 AI 的市场规模预测 | 未找到权威原始报告 | 已改用可核查的替代数据（GitHub star、官方定价页、Menlo 支出数据） |
| 本机 `npm test` 无法运行 | 环境问题（Node 16.14.1 < vite 7 要求）。**已缓解**：`package.json` 补 `engines`（`^20.19.0 \|\| >=22.12.0`）+ `.nvmrc`（22），新环境会先看到版本提示而不是语法崩溃 | 用 Node ≥20.19 复跑 `npm test` / `npm run lint` 确认 301 条基线 |
| **文档改动的正确性** | 所有修改均基于代码/配置/产物的一手核对（含实测 `dist-embed` 体积与 gzip），但**未能在本机跑测试验证**（Node 版本不达标） | 在合格环境下跑 `npm test` + `npm run lint`；重点复核 `INTEGRATION.md` 的产物体积数字与新增构造参数 |

---

## 附：核实到的一手来源清单

**本仓库内的调研底稿**（由本次评审附带产出，可直接复核每条结论的原始出处）：
- `research/browser-runtime-landscape-2026-09.md` —— 浏览器端运行时格局（WebGPU 覆盖率、Prompt API、
  WebLLM/MLC 生态、WebMCP、关键约束、附录含未核验条目清单）
- `research/local-ai-market-2026-09.md` —— 本地/端侧 AI 助手产品与市场格局（GitHub 量级、MCP 生态、
  商业化定价、失败案例）

**外部一手来源**：
- WebGPU 支持与覆盖率：<https://caniuse.com/webgpu>
- WebLLM 能力边界（function calling WIP、SRI、cacheBackend、worker 引擎）：
  <https://raw.githubusercontent.com/mlc-ai/web-llm/main/README.md>、[v0.2.85 release](https://github.com/mlc-ai/web-llm/releases/tag/v0.2.85)
- Prompt API 规范（原生 tools / responseConstraint / availability）：<https://github.com/webmachinelearning/prompt-api/blob/main/README.md>
- 引擎立场：<https://github.com/WebKit/standards-positions/issues/495>（oppose Prompt API）、
  <https://github.com/mozilla/standards-positions/issues/1213>（negative Prompt API）、
  <https://github.com/WebKit/standards-positions/issues/670>（oppose WebMCP）、
  <https://github.com/mozilla/standards-positions/issues/1412>（neutral WebMCP）
- WebMCP 规范与浏览器实现状态：
  <https://raw.githubusercontent.com/webmachinelearning/webmcp/main/README.md>、
  <https://raw.githubusercontent.com/webmachinelearning/webmcp/main/implementation-status.md>、
  <https://webmachinelearning.github.io/webmcp/>
- Qwen3.5 档位、Apache-2.0 与官方 agent 分数：<https://raw.githubusercontent.com/QwenLM/Qwen3.5/main/README.md>、
  Qwen/Qwen3.5-2B 模型卡
- sub-2B 工具调用横评：LiquidAI/LFM2.5-1.2B-Instruct 模型卡
- Transformers.js 版本：<https://registry.npmjs.org/@huggingface/transformers/latest>；Orama 版本：<https://registry.npmjs.org/@orama/orama/latest>
- MCP 规范演进与生态量级：<https://blog.modelcontextprotocol.io/posts/2026-07-28/>
- 本地模型工具量级与商业化：<https://api.github.com/repos/ollama/ollama>、<https://ollama.com/pricing>、
  <https://lmstudio.ai/pricing>、<https://lmstudio.ai/docs/app/mcp>
- 消费级 AI 支出：<https://menlovc.com/perspective/>
- 项目实际依赖的 SDK 能力：`node_modules/@missionsquad/browserai/dist/{index,client,config,models,model-cache,hardware,generation}.d.ts` + `models.js` + `inference.js`

> **检索条件说明**：`web_search` 通道不可用（无 API key），所有外部结论均由 `web_fetch` 直取一手页面；
> `developer.chrome.com`、`chromestatus.com`、`developer.mozilla.org` 在当前网络策略下不可达，
> 因此"Chrome 内置 AI 的具体版本与平台覆盖"未被核验，已在 §5 明确标注，未做推测填充。
