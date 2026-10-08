# 迭代计划

> **定位**：技术作品（非商业组件） · **许可证**：MIT · **npm 发布**：暂不做
> **状态标记**：`[x]` 已完成 · `[~]` 已实现待验证 · `[ ]` 待开始
> **维护约定**：完成一项即把 `[ ]` 改为 `[x]`；新增任务追加到对应批次末尾。
> 变更与验证的过程由 git 记录，本文档只保留**计划、依据与结论**。
>
> 最后更新：2026-09-28

## 固定动作（每批结束都要做）

1. `npm test` + `npm run lint`；涉及端到端行为时再跑 `npm run test:e2e`（需 proxy + dev，且需真实 WebGPU）
2. 同步文档：新增 / 变更的能力、命令、限制必须落到 `README.md` / `USAGE.md` / `INTEGRATION.md`
3. 默认行为变更必须在提交信息里写明回退开关

## 当前状态

- **测试与检查基线**：批次 A 之前为 `npm test` = **301 passed / 21 files**、`npm run lint`（`--max-warnings=0`）= **0 问题**
  （已用 Node 22.23.2 复跑确认；本机默认 Node 16.14.1 低于 Vite 7 要求，需 `nvm use 22`）。
  批次 A 调整了单测（新增快照矩阵 / 元数据锚定 / 接线 / SW 守卫，删除 cacheFirst 旧测），
  **预计 ~311 条，待在合格环境复跑确认**
- **已完成**：第 0 批全部；第 1 批的 P0-1a / P0-1b / P0-1c；第 2 批的 P0-3 与「解析器兼容性」条目；
  **REVIEW 批次 A 的 A1 / A4 / A5 / A8 / A9**
- **暂缓**：第 1 批的 P0-2 / P0-2b / P0-2c（需真实 WebGPU 做协议 A/B 与约束解码生效性确认）
- **下一步**：见下方「下一步行动清单（P0–P4）」
- **批次 A 实施备注**：A1 采方案①（SW 不再拦截模型路径，`VERSION` v2→v3 以回收历史死副本）；
  A4 的显存门槛按与 0.8B / 2B 相同的"向上取整到 0.1GB"口径定为 **3.8GB**（SDK 权威值 3867.82MB），
  而非 REVIEW 建议的 3.9GB；A5 额外引入 `recommendMinCores`——4B 自动推荐门槛为 12 核，因为
  `navigator.deviceMemory` 被 clamp 到 8GB，无法区分 8 核 16GB 与 16 核 32GB

## 下一步行动清单（2026-09-28 制定）

> **归属标记**：**你** = 需真机 WebGPU / 需人工决策；**可接手** = 无 WebGPU 环境即可完成。
> 完成一项即把 `[ ]` 改为 `[x]`。P0 / P1 是批次 A 的收尾，未完成前不要开新功能。

### P0 · 验证与提交（约 15 分钟）

- [ ] **P0-A 切换 Node 版本**：`nvm use 22.23.2`（本机默认 16.14.1 跑不了 vitest）
- [ ] **P0-B 跑门禁（你）**：`npm test`（预期 301 → ~311）、`npm run lint`；失败则把输出贴回按结果修
- [ ] **P0-C 提交批次 A**：提交信息须写明回退开关
      （A1 = 恢复 `public/sw.js` 的 `isModelRequest` 分支并递增 `VERSION`；A5 = 删除 `src/main.js` 的 `model-recommended` 分支）

### P1 · 真机验收（你）——A1 / A5 唯一能被证明的地方

- [ ] **P1-A** `npm run proxy` + `npm run dev` → 打开 <http://127.0.0.1:5189>
  - **A5**：控制台 `[embed] 已初始化` 附近出现「为你的设备推荐：…」，且下拉自动切到推荐档（4 核以上应为 2B，不再是 0.8B）
  - **A1**：DevTools → Application → Cache Storage 只有 `local-agent-app-v3`，**没有** `local-agent-models-*`；
    从旧版本升级的浏览器里，遗留的 `local-agent-models-v2` 已被 activate 清掉
  - **清理归零**：加载 2B 档后记录 `await agent.getStorageEstimate()` → `await agent.deleteModelArtifacts()` → 占用应回落到加载前量级
  - **A1 离线回归（最容易出事的一条，必做）**：模型加载完成后，在 DevTools → Network 面板再次 `await agent.load()`，
    确认**没有新的 `/hf/*` 请求**——这一步验证的是 REVIEW 的代码推断"SDK 缓存命中后不再发起 fetch"，
    该推断**从未实测**。随后断网（或 Network 面板切 Offline）→ 刷新页面 → 再加载模型，**必须仍能就绪**。
    **若失败**（离线加载不出来）：说明 SDK 仍会发 fetch，A1 需改采方案②——恢复 SW 拦截，但让
    `deleteModelArtifacts()` 一并 `caches.delete("local-agent-models-*")`，并在 UI/README 说明存在两层缓存
- [ ] **P1-B** `npm run test:offline`（需 proxy + dev 已启动）
- [ ] **P1-C** `npm run test:e2e`（需真实 WebGPU）

### P2 · 需人工决策

- [ ] **P2-A** A5 的 12 核门槛是否接受（影响：8 核 16GB 机器不自动推 4B）；要改只动 `MODEL_OPTIONS` 的 `recommendMinCores`
- [ ] **P2-B** 是否启动第 5 批（多模态 / 语音）：代价是 `dist-embed/` 从 ~6MB 涨到 67MB
- [ ] **P2-C** `.tmp/verify-a1.mjs` / `verify-a5.mjs` 是否正式化到 `tests/`
      （沙箱内不依赖 vitest 的等价验证脚本，当前留在 gitignore 的 `.tmp/`）

### P3 · 真机测量（你）——批次 A′ 与第 1 批剩余

- [ ] **P3-A** A2 采样参数：`temperature` 0.2–0.5 + `seed: null`（保留 `repetitionPenalty` / `frequencyPenalty`），连问 3 次看措辞变化与 `getStats().toolFailures`
- [ ] **P3-B** A3 推理进 Worker：生成时用 Performance 面板看 long task 是否 >50ms 且频繁
- [ ] **P3-C** A6 上下文：核实 MLC `max_history_size: 1` 的语义，并用长对话看 `failureLog` 有无 context 相关失败
- [ ] **P3-D** P0-2 三协议 A/B（决定 `auto` 默认值）
- [ ] **P3-E** P0-2c `json` 约束解码在 0.8B / 2B / 4B 三档的生效性

### P4 · 后续排期（可接手）

- [ ] **P4-A** `REVIEW.md` D4 评测基线：20 条工具调用用例（多步 / 需拒绝调用 / 参数缺失 / 诱导注入）
      + 成功率 / 平均步数 / TTFT 表格——**P3-A、P3-D 与 C2 的收益都以它为前置**
- [ ] **P4-B** C3 搜索工具重做（SearXNG 经 `dev-proxy` 同源转发，保留 Wikipedia 兜底）
- [ ] **P4-C** C2 工具调用可靠性三件套（含"一次输出多个 `tool_call` 时顺序执行"，现状会静默丢弃）
- [ ] **P4-D** 第 5 批多模态（B1 截图理解 / B2 语音 / B3 能力槽位可视化）
- [ ] **P4-E** 批次 C 的 C1 WebMCP 适配器 + C1b 安全闸门

## 第 0 批 · 基础设施（已完成）

- [x] 文档重写：`README.md` / `USAGE.md` / `INTEGRATION.md` / `vite.embed.config.js`
- [x] 三种工具调用协议 `toolProtocol: "auto" | "react" | "native" | "json"`
- [x] `stripThinking` 支持 ` thinking` / ` response` 标签
- [x] 约束解码通道：`buildDecisionSchema()`（`src/toolSchemas.js`）+ `parseStructuredDecision()`（`src/agentLoop.js`）
- [x] 存储管理 API：`getStorageEstimate()` / `getCacheStatus(modelId?)` / `deleteModelArtifacts(modelId?)`
- [x] 单测 `tests/unit/agentLoop.protocol.test.js`
- [x] MIT 许可证：`LICENSE` + `package.json` 的 `"license": "MIT"` + README 许可证段落
- [x] 代码与注释清理：无死代码、无未引用 CSS 类、无残留临时文件

## 第 1 批 · 基线验证

> 状态：P0-1a / P0-1b / P0-1c 已完成；P0-2 系列**暂缓**（需真实 WebGPU），不阻塞第 2 批。

- [x] **P0-1a 单元测试**：`npm test` 全绿
- [x] **P0-1b ESLint**：`npm run lint` 零问题（CI 门禁 `--max-warnings=0`）；已配 `precommit` script 与 pre-commit hook
- [x] **P0-1c 补齐单测缺口**：`stripThinking` 的 ` thinking` 分支、`embed.js` 的三个存储 API
- [ ] **P0-2 三种协议 A/B 实测**
  方法：同一批问题分别在 `toolProtocol: "react"` / `"native"` / `"json"` 下跑
  记录：工具调用成功率、答案正确性、首 token 延迟，以及 native 下长期记忆是否被更激进裁剪
  （system prompt 1067 → 2663 字符，预算 3200）
- [ ] **P0-2b 据实测结论确定 `auto` 默认行为**
  当前：`auto` → Qwen 档位走 `native`。若实测更差则回退为默认 `"react"`
- [ ] **P0-2c 确认 `json` 约束解码在 Qwen3.5 0.8B / 2B / 4B 上均生效**
  依据：SDK 仅在传入 `schema` 时才生成 `response_format`；`GenerateOptions.schema` 注释为 "WebLLM constrained decoding"

## 第 2 批 · 低风险高收益

- [ ] **P1-4 新增 Qwen3.5-9B 档位（暂缓，优先级低于批次 B/C 的能力项）**
  依据：9B 的 MLC 权重确实存在（`mlc-ai/Qwen3.5-9B-q4f16_1-MLC`，q4f16_1 的 VRAM **6433MB**、q4f32_1 为 7544MB），
  但**不在 SDK 的 `MODEL_PRESETS` 目录内**（该目录只有 0.8B / 2B / 4B），而 `getAvailableModelOptions()` 会过滤掉
  目录外的 id——**仅补 `MODEL_OPTIONS` 元数据不会让它出现在下拉里**。要做必须走自定义 ModelRecord 路线
  （SDK 暴露了 `CUSTOM_MODEL_RECORDS` / `withCustomModelRecords`，Gemma 4 档就是这么接的），
  需自备 `model` + `model_lib` URL 并保证代理可达
  结论：6.4GB 显存门槛把绝大多数设备排除在外，且在 4B 尚未被推荐逻辑正确启用之前做 9B 属于优化用不到的档位
- [x] **P0-3 修复 Service Worker 注册路径与 scope**
  已支持 `serviceWorker` / `swPath` / `swScope` 三个选项，scope 默认取脚本所在目录
  遗留（真机验收）：子路径部署后 DevTools → Application → Service Workers 显示 activated，且宿主原有 SW 未被替换
- [ ] **P0-6（可选）抽出 `resolveToolProtocol(requested, modelId)`**
  现状：`auto` 判定是 `src/embed.js` 里的内联表达式，不便单测
  验收：新单测覆盖 Qwen / 非 Qwen / 显式三值
- [x] **新模型接入验收补「解析器兼容性」一条**（`README.md` 已补，并加上"档位必须在 SDK `MODEL_PRESETS` 目录内"的前置条件）

## 第 3 批 · 观感与存储可视化

- [ ] **P1-3a 对话气泡支持 Markdown 渲染 + 代码复制**
  问题：`src/chatWidget.js` 用 `bubble.textContent` 纯文本渲染，模型输出的列表/代码块不生效
- [ ] **P1-3b 显式"停止生成"按钮**
  现状：功能已实现（`abortController`），但交互是"再点一次发送=停止"，发现性差
- [ ] **P0-4 存储占用显示 + 清理入口**
  接已就绪的 `getStorageEstimate()` / `getCacheStatus()` / `deleteModelArtifacts()`
  验收：点击清理后占用数值下降，且对话历史仍在；同时更新 `README.md` 的「存储」限制条目
  前置已解除：权重存两份的问题已由 A1 修复（模型缓存唯一在 SDK 侧），清理后占用会真实下降

## 第 4 批 · 检索增强

- [ ] **P1-2 浏览器内 RAG**
  现状：`read_page_content` 是"整页截断 4000 字符"塞给模型；`memory.recall()` 只做关键词匹配
  做法：Transformers.js `feature-extraction` 生成 embedding + **Orama** 做向量/全文混合检索
  （不要用 Voy：旧仓库路径已失效；Orama 仍在活跃维护）
  验收：页面问答改为引用检索到的片段，输入模型的正文从 4000 字符量级降到 800 字符量级
  注意：SDK 本身不提供 embedding API（`index.d.ts` 无相关导出），需自行引入 `@huggingface/transformers`

## 第 5 批 · 多模态（技术作品的最强展示点）

> 前置（已测算，代价明确）：**多模态与语音档位全部走 Transformers.js 后端**，因此必须上传
> `dist-embed/transformers.web-*.js`——实测约 **60.9MB**（gzip 16.9MB）。方式二的部署体积会从
> "仅 WebLLM 时的约 6MB" 涨到 **67MB**（这也是 README「方式二」里"可省掉 61MB"优化的失效条件）。
> 缓解路径：① 宿主有构建工具时用方式一（源码复用），体积由宿主打包决定；② 为多模态单独出一个可选构建产物。
> **决策：接受代价、启动本批**——体积只影响"无构建工具的宿主"这一种接入方式，而多模态是纯浏览器
> agent 相对云端方案唯一无法被替代的能力（截图不出端）。

- [ ] **P1-5a 截图理解当前页面**
  依据：SDK 已提供 `describeImage()`，目录中有 `SmolVLM 256M/500M`、`Qwen3-VL 2B`、`Qwen2.5-VL 3B`、`GLM-OCR`、`LightOnOCR-2`
  补充：可加工具 `describe_page_region`（截取可视区域或某 selector 的画面 → VLM 描述），补掉
  `read_page_content` 对图表 / 图片 / 布局的结构性盲区（见 `REVIEW.md` B1）
- [ ] **P1-5b 语音提问 / 朗读回答**
  依据：SDK 已提供 `transcribe()`（Whisper / Moonshine / Parakeet，可回退 wasm）与流式 TTS（Kokoro 82M / Supertonic），
  以及现成的 `VoicePipeline`（mic → STT → LLM → TTS，含 barge-in 与句级流式播报）
  补充：能力槽位（text / vision / stt / tts）最多可同时驻留 4 个模型，UI 上把驻留状态可视化即是技术密度展示（`REVIEW.md` B3）

## 第 6 批 · 可选增强

- [ ] **P1-1 搜索工具重做**
  问题：`src/tools.js` 用的是 DuckDuckGo **Instant Answer** API（只返回摘要/相关主题，常为空），不是真实网页搜索
  做法：自建 SearXNG，经 `server/dev-proxy.mjs` 同源转发（规避 CORS）；保留 Wikipedia 兜底
- [ ] **门面打磨：`search.html` 一键演示**
  建议按钮：「现在几点」/「12×34」/「总结本页」——降低首次体验的认知成本（当前必须先下载数百 MB 权重：
  0.8B 档约 447MB、2B 档约 1.2GB。若采纳低配档方案，门槛还可进一步下降）
- [ ] **低配置体验档（SDK 目录里已现成，只是未接入）**
  目的：把首次体验门槛从数百 MB 降到百 MB 级
  依据：SDK 的 47 个 preset 里**已经有**这些档——`LiquidAI/LFM2.5-230M / 350M / 1.2B-Thinking`（ONNX）、
  `granite-4.0-350m / 1b / micro`、`Falcon-H1-Tiny-90M`、`MiniCPM5-1B`、`SmolLM3-3B`，
  因此这件事的成本从"找模型 + 验证"降为"补 `MODEL_OPTIONS` 元数据 + 跑解析器兼容性"
  工具调用维度的参照（**厂商自测**口径，BFCLv3）：Granite 4.0-1B **52.43** > LFM2.5-1.2B **49.12** >
  Qwen3-1.7B 46.30 > Gemma 3 1B IT **16.64**——同为 ~1B 级差距可达 3 倍，**选哪个比选多大更重要**
  注意：① Transformers.js 后端是 prompt-based 生成，**不支持** WebLLM 的 grammar 约束解码
  （`toolProtocol: "json"` 只对 MLC 档生效）；② 这些档位非国内开源，接入需显式调整
  `modelLoader.js` 顶部"只列国内开源"的策略并说明理由（可定位为"agent 能力优先"，同时保留 Qwen 为默认档）
- [ ] **统计面板（技术密度可视化）**
  数据已就绪：`getStats()`（TTFT / 工具耗时 / 失败率）、`failureLog`（最近 20 条失败原因）
- [ ] **支持"一次输出多个工具调用"（顺序执行）**
  现状：`parseToolCallXml()` 与 `extractJsonToolCall()` 都**只取最后一个**工具调用块，模型一次输出多个
  `<tool_call>` 时前面的会被静默丢弃
  依据：WebMCP 规范明确提示"模型可能并发调用同一工具多次"，Prompt API 的 tools 设计也以 `Promise.all` 语义
  等全部返回后再生成；只要模型有并行意图，顺序执行多个调用（而非丢弃）就是净收益，且不需要真正的并发调度
  做法：解析器返回数组 → 循环里顺序执行每个工具并分别注入 observation；仍用 `MAX_STEPS` 兜底
  验收：构造"一次输出两个 tool_call"的模型输出，两个工具都执行；既有单测（只取最后一个的断言）同步更新
- [ ] **react 协议 few-shot 示例扩充（需实测决定）**
  依据：二手评测显示，把 persona 改写为带 3-5 个 "utterance → call" 具体示例后，弱模型提升 ≥20 分；
  当前 react 协议的 system prompt 只有 1 个示例（"现在几点"），而工具有 6 类（时间 / 计算 / 搜索 / 页面 / 记忆读写）
  代价：示例占用 `SYSTEM_PROMPT_BUDGET`（3200 字符），且 `native` / `json` 协议不走 `buildSystemPrompt`，
  因此**只对 react 协议生效**，是否值得需实测
- [ ] **档位推荐结合工具调用能力（当前只按硬件）**
  依据：参数量不是工具调用能力的可靠指标（BFCLv3 厂商自测口径下，同为 ~1B 级可从 16.6 到 52.4）。
  可用的官方数据是 Qwen3.5 自己的自测分：**BFCL-V4 2B=43.6 / 0.8B=25.3；TAU2-Bench 2B=48.8 / 0.8B=11.6**（4B 未公布）
  现状：A5 已完成接线与核数/显存判定，"按硬件推荐"不再是空转；但权重里仍**没有**工具调用能力这一维
  做法：把工具调用成功率纳入权重前，先用本地评测基线取数（`REVIEW.md` D4），而不是引用厂商自测分
- [ ] **`json` 模式的观感优化（是否要做取决于 P0-2 结论）**
  问题：约束解码下流式输出是 JSON 文本，"思考过程"里看不到自然语言
  思路：只在"工具决策步"用约束解码，最终回答改用自由文本生成（代价是多一次推理）

## 长期 / 需定位决策

- [ ] **P2-1 双后端适配层**：浏览器内置 Prompt API ↔ 自带 WebGPU 模型（可做，见 `REVIEW.md` D5）
  依据：Prompt API 规范已把**原生工具调用**写进 API——`LanguageModel.create({ tools })`（UA 自动执行
  `execute()` 并回灌结果、model-agnostic）与 `responseConstraint`（JSON Schema / RegExp 结构化输出），
  恰好覆盖本项目自建的 `getOpenAIToolsFormat()` + `buildDecisionSchema()`；`availability()` 取值为
  `unavailable / downloadable / downloading / available`，可做零下载秒开路径
  约束（决定了它只能是增强路径）：① WebKit 对 Prompt API 投 **oppose**、Mozilla 投 **negative**，
  跨浏览器基线仍只能是自带模型；② 仅 top-level Window 与同源 iframe，**规范明确"目前不在 Worker 中可用"**
  ——与 `REVIEW.md` A3（把 WebLLM 推进 Worker）属于不同线程模型，抽象层必须把这一点作为后端能力暴露；
  ③ 不支持多模态输出；④ 官方 non-goals 允许"永远返回无模型"甚至纯云端实现
- [ ] **P2-3 离线 / 内网发行包 + SRI 校验**
  依据：WebLLM 支持 `integrity`（sha256 校验 config / model_lib / tokenizer，失败抛 `IntegrityError`，
  可设 `onFailure: "warn"`），可回应第三方镜像的供应链风险；SDK 侧需要经 `withCustomModelRecords` 注入
- [ ] **P2-4 浏览器扩展形态 / WebMCP 工具消费**（可做，见 `REVIEW.md` C1）
  依据：Chrome **149** / Edge **150** 已上线 Origin Trial，ChatGPT Desktop 已支持，Brave Leo 实验性支持；
  API 已定为 `document.modelContext`（`registerTool` / `getTools` / `executeTool` + `toolchange` 事件 +
  `exposedTo` 跨源白名单 + `annotations{readOnlyHint, untrustedContentHint, consequentialHint}`）；
  规范为 W3C CG Draft（不在 Standards Track），且 WebKit **oppose**、Mozilla **neutral** → 只能做
  Chromium 增强路径 + 特性检测降级。配套必做安全闸门见 `REVIEW.md` C1b（带副作用的工具需用户确认）

## 明确不做

- **不等 WebLLM 原生 `tools` / `tool_choice`**（上游 0.2.85 仍标 `(WIP)`，且 `functionCallingModelIds`
  白名单只有 5 个 7B/8B 档、≤4B 一条都没有）→ 用 `json` 约束解码达到等价效果
- **不为 MPA 做 DOM 层兼容** → 正确路径是模型常驻（WebLLM 已提供 `ServiceWorkerMLCEngine`），但 SDK 未暴露该能力，属上游依赖
- **不做 npm 发布**（定位为技术作品）
- **不做工程治理类扩充**：CHANGELOG / Dependabot / Issue 模板 / coverage 阈值（截至当前定位收益低；LICENSE 已补齐）

## 决策记录

- [x] 项目定位：**技术作品**（优先"效果可见 + 技术密度"，而非可集成性）
- [x] 许可证：**MIT**
- [x] npm 发布：**暂不做**（`package.json` 保持 `private: true`）
- [ ] 默认工具协议：待第 1 批实测结论（当前 `auto → native`）
- [x] 多模态体积：**接受**（方式二部署体积 6MB → 67MB，仅影响"无构建工具的宿主"这一种接入方式）→ 第 5 批可启动
- [x] 采纳 `REVIEW.md` 批次 A 的必修项（A1 双重缓存 / A4 显存门槛 / A5 推荐接线 / A8 文档 / A9 文案）：**已实施**
  - A1 选方案①：SW 不再拦截模型路径，模型缓存唯一交给 SDK 的 IndexedDB（`VERSION` v2 → v3 以回收历史死副本）
  - A4 定为 3.8GB（与 0.8B / 2B 同口径的向上取整）；A5 另引入 `recommendMinCores`（4B 需 12 核以上才自动推荐）

## 风险登记

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| `json` 约束解码在三档上是否生效未验证 | 决定协议默认值 | 第 1 批 P0-2c 实测；不生效则回退 `native`。旁证：WebLLM 依赖 `@mlc-ai/web-xgrammar`，机制真实存在，但**官方未文档化其 JSON Schema 子集边界**，需自测 |
| native 协议 system prompt 变长（1067 → 2663 字符） | 长期记忆可能被裁到 400 字符 | 回退 `"react"`；或精简 `toolsJson`；或调 `SYSTEM_PROMPT_BUDGET`（会动既有预算单测）。**备选**：SDK 的 `LoadOptions.contextLength` 可把窗口从默认 4096 上调（上限 32768），比缩提示词更直接——但需先确认历史是否真的进了上下文（MLC 的 Qwen3.5 条目带 `max_history_size: 1`，语义待核实） |
| ~~**模型权重被存两份**~~（已修复，见 `REVIEW.md` A1） | —— | 已实施：SW 不再拦截模型路径，模型缓存唯一交给 SDK 的 IndexedDB；`VERSION` v3 的 activate 阶段回收历史死副本 |
| ~~**"设备自适应推荐"在主页面未接线**~~（已修复，见 `REVIEW.md` A5） | —— | 已实施：`main.js` 消费 `model-recommended` 事件写回下拉；推荐逻辑改为"核数门槛 + 推荐门槛 + 显存预算"后取最高档 |
| A5 的档位映射未经真机验证（12 核门槛属工程判断，非实测结论） | 8 核 16GB 的机器不会被自动推 4B，需在页面手动选择 | A′ 测量阶段用真实设备核对；门槛集中在 `MODEL_OPTIONS.recommendMinCores` 一处，可随时调整 |
| 无 WebGPU 设备完全不可用（覆盖率 **85.72%**，caniuse 2026-08；桌面 Safari 仅 partial、Firefox 157–159 仍默认关闭） | 约 14% 流量池无法使用 | 未排期；候选方案是 wllama（GGUF / wasm）等非 WebGPU 后端 |
| 上游 function calling 长期停留 WIP（0.2.85 仍标 WIP，`functionCallingModelIds` 仅 7B/8B） | 无法依赖 `tools` / `tool_choice`，工具调用需自维护 | 已用三协议 + 约束解码规避；持续跟踪上游，落地后可减少自维护的解析路径 |
| 第三方权重镜像的供应链风险 | 权重可能被篡改 | P2-3 的 SRI 校验（WebLLM 已原生支持 `integrity`）；README 已声明不重新分发权重 |
