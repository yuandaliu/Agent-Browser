# 迭代计划

> **定位**：技术作品（非商业组件） · **许可证**：MIT · **npm 发布**：暂不做
> **状态标记**：`[x]` 已完成并验证 · `[~]` 已实现待验证 / 进行中 · `[ ]` 待开始
> **维护约定**：每完成一项，把 `[ ]` 改为 `[x]`，并在该项下用 `→` 追加一行验收结论（跑的命令 + 观察结果）。
> 新增任务追加到对应批次末尾，不要回头改动已完成批次。
>
> 最后更新：2026-09-16

## 固定动作（每批结束都要做）

1. `npm test` + `npm run lint`；涉及端到端行为时再跑 `npm run test:e2e`（需 proxy + dev，且需真实 WebGPU）
2. 同步文档：新增 / 变更的能力、命令、限制必须落到 `README.md` / `USAGE.md` / `INTEGRATION.md`
3. 默认行为变更必须在提交信息里写明回退开关

## 当前进度（2026-09-16）

- **已完成**：第 0 批全部 7 项 + 第 1 批的 P0-1a（单元测试）/ P0-1c（补齐测试缺口）；`npm test` = **290 passed / 19 files**
- **暂缓**：第 1 批剩余 4 项 —— P0-1b（ESLint，本地未安装 eslint）、P0-2 / P0-2b / P0-2c（需真实 WebGPU 做协议 A/B 与约束解码生效性确认）
- **下一步建议**：第 2 批（P1-4 新增 9B 档、P0-3 修 SW 注册路径与 scope）——纯代码改动，**不依赖第 1 批结论**，可直接开工

## 第 0 批 · 本轮已完成（端到端行为待 P0-2 实测）

- [x] 文档重写：`README.md` / `USAGE.md` / `INTEGRATION.md` / `vite.embed.config.js`（修正 8 处事实错误、去重、去 emoji 与 mermaid）
  → 已提交并推送：`7cd1aad docs: 重写集成与项目文档`
  → 2026-09-16 二次修订：同步三种工具协议、补 `buildDecisionSchema()` 到 API 表、删去不实的"SDK 原生 tool calling"表述、修正硬件限制的错误描述
- [x] 三种工具调用协议 `toolProtocol: "auto" | "react" | "native" | "json"`
  → `npm test` 通过：`fitSystemPrompt` 协议分支、`buildNativeToolPrompt`、`buildJsonDecisionPrompt`、`buildToolsJsonLines` 均已覆盖；**端到端行为待 P0-2 实测**
- [x] `stripThinking` 支持 ` thinking` / ` response` 标签（此前只认 `<|thinking|>`）
  → `npm test` 通过（2026-09-16）：新增 3 条用例（` think` 标签剥离 / 空推理段 / `<|im_start|>assistant` 真实模板形态）
- [x] 约束解码通道：`buildDecisionSchema()`（`src/toolSchemas.js`）+ `parseStructuredDecision()`（`src/agentLoop.js`）
  → `npm test` 通过（schema 约束、决策 JSON 解析、`null` 兜底路径均已覆盖）；**"约束解码在真机三档上是否真实生效"待 P0-2c 确认**
- [x] 存储管理 API：`getStorageEstimate()` / `getCacheStatus(modelId?)` / `deleteModelArtifacts(modelId?)`
  → `npm test` 通过（2026-09-16）：`embed.test.js` 新增 9 条用例（估算 / 缓存 / 清理三组，含 SDK 抛错降级与 id 回落）
- [x] 新增单测 `tests/unit/agentLoop.protocol.test.js`
  → 2026-09-16 `npm test` 通过
- [x] MIT 许可证：新增 `LICENSE` + `package.json` 的 `"license": "MIT"` + `README.md` 许可证段落
- [x] 代码与注释清理（2026-09-16）：删除全部变更史注释——`src/` 15 处（"此后/此前漏了/关键改动/修复前"）、`tests/unit/` 20 处（"锁住这一轮（v2）"等）、`public/sw.js` + `server/dev-proxy.mjs` 6 处，并统一 `index.html` 的协议用词（"ReAct 循环" → "工具调用循环"）
  → 静态核查结论：无死代码（62 个导出全部有引用、私有函数零闲置、无未使用 import）、无未引用 CSS 类（54 个 class 全部在用）、无残留临时文件（`.tmp` 为空）；`node --check` 38 个 JS 文件全部通过
  → `npm test` 通过（2026-09-16）：**290 passed / 19 files**，注释清理零副作用

## 第 1 批 · 基线验证（当前暂缓）

> 状态：P0-1a / P0-1c 已完成；其余 4 项**暂缓**（需真实 WebGPU 或本地 lint 环境），不阻塞第 2 批。

- [x] **P0-1a 单元测试**
  命令：`npm test`
  → 结论（2026-09-16）：**通过**。既有用例全绿（`react` 仍为默认协议，`Observation:` 前缀断言未受影响），新增 `agentLoop.protocol.test.js` 全绿
- [ ] **P0-1b ESLint**
  命令：`npm run lint`（CI 有 `--max-warnings=0` 门禁）
  注：本地 `node_modules` 未安装 eslint，尚未执行
- [x] **P0-1c 补齐单测缺口**
  缺口：`stripThinking` 的 ` thinking` 分支、以及 `embed.js` 的三个存储 API（`getStorageEstimate` / `getCacheStatus` / `deleteModelArtifacts`）
  → 完成（2026-09-16）：`agentLoop.test.js` 加 3 条、`embed.test.js` 加 9 条；`npm test` = **290 passed / 19 files**（`agentLoop.test.js` 45、`embed.test.js` 24、`agentLoop.protocol.test.js` 23）
  → 第 0 批对应的两项（`stripThinking`、存储管理 API）已随之转为 `[x]`
- [ ] **P0-2 三种协议 A/B 实测**
  方法：同一批问题分别在 `src/main.js` 的 `createLocalAgent(...)` 调用处传 `toolProtocol: "react"` / `"native"` / `"json"` 下跑
  记录：工具调用成功率、答案正确性、首 token 延迟、以及 native 下长期记忆是否被更激进裁剪（system prompt 实测 1067 → 2663 字符，预算 3200）
- [ ] **P0-2b 据实测结论确定 `auto` 默认行为**
  当前：`auto` → Qwen 档位走 `native`。若实测更差则回退为默认 `"react"`
  → 结论：_（待记录）_
- [ ] **P0-2c 确认 `json` 约束解码在 Qwen3.5 0.8B / 2B / 4B 上均生效**
  依据：SDK 仅在传入 `schema` 时才生成 `response_format`；`GenerateOptions.schema` 注释为 "WebLLM constrained decoding"
  → 结论：_（待记录）_

## 第 2 批 · 低风险高收益

- [ ] **P1-4 新增 Qwen3.5-9B 档位**
  依据：`mlc-ai/Qwen3.5-9B-q4f16_1-MLC` 已核实存在（2026-04-22 发布），另有 `q4f32_1` 变体可做质量对比
  改动：`src/modelLoader.js` 的 `MODEL_OPTIONS` 补元数据（tier / sizeMB / minVRAMGB / minCores / description）
  验收：目标机器实测可加载；既有单测的"在 SDK 目录内 / 全为国内开源"断言仍通过
- [ ] **P0-3 修复 Service Worker 注册路径与 scope**
  问题：`src/embed.js` 硬编码 `register("/sw.js", { scope: "/" })` → 子路径部署（如 `/local-agent/`）SW 静默失效；且 `scope:"/"` 会让组件 SW 接管宿主全站、与宿主自有 SW 抢占同一 scope
  做法：改用 `new URL("sw.js", import.meta.url)`，或新增 `swPath` / `swScope` / `serviceWorker: false` 选项，默认 scope 收缩到组件目录
  验收：部署到子路径后 DevTools → Application → Service Workers 显示 activated；宿主原有 SW 未被替换
- [ ] **P0-6（可选）抽出 `resolveToolProtocol(requested, modelId)`**
  现状：`auto` 判定是 `src/embed.js:275` 的内联表达式，不便单测
  验收：新单测覆盖 Qwen / 非 Qwen / 显式三值

## 第 3 批 · 观感与存储可视化

- [ ] **P1-3a 对话气泡支持 Markdown 渲染 + 代码复制**
  问题：`src/main.js` 用 `bubble.textContent` 纯文本渲染，模型输出的列表/代码块不生效
- [ ] **P1-3b 显式"停止生成"按钮**
  现状：功能已实现（`abortController`），但交互是"再点一次发送=停止"，发现性差
- [ ] **P0-4 存储占用显示 + 清理入口**
  接已就绪的 `getStorageEstimate()` / `getCacheStatus()` / `deleteModelArtifacts()`
  验收：点击清理后占用数值下降，且对话历史仍在；同时更新 `README.md` 的「存储」限制条目

## 第 4 批 · 检索增强

- [ ] **P1-2 浏览器内 RAG**
  现状：`read_page_content` 是"整页截断 4000 字符"塞给模型；`memory.recall()` 只做关键词匹配
  做法：Transformers.js `feature-extraction` 生成 embedding + **Orama** 做向量/全文混合检索（**不要用 Voy**：2023-09 已停更）
  验收：页面问答改为引用检索到的片段，输入模型的正文从 4000 字符量级降到 800 字符量级

## 第 5 批 · 多模态（技术作品的最强展示点）

> 前置：确认可接受体积代价（`dist-embed/` 需整体上传，且不能再排除 Transformers.js chunk）。**待定决策。**

- [ ] **P1-5a 截图理解当前页面**
  依据：SDK 已提供 `describeImage()`，目录中有 `SmolVLM 256M/500M`、`Qwen3-VL 2B`、`Qwen2.5-VL 3B`
- [ ] **P1-5b 语音提问 / 朗读回答**
  依据：SDK 已提供 `transcribe()`（Whisper / Moonshine / Parakeet）与流式 TTS（Kokoro 82M）

## 第 6 批 · 可选增强

- [ ] **P1-1 搜索工具重做**
  问题：`src/tools.js` 用的是 DuckDuckGo **Instant Answer** API（只返回摘要/相关主题，常为空），不是真实网页搜索
  做法：自建 SearXNG，经 `server/dev-proxy.mjs` 同源转发（规避 CORS）；保留 Wikipedia 兜底
- [ ] **门面打磨：`search.html` 一键演示**
  建议按钮：「现在几点」/「12×34」/「总结本页」——降低首次体验的认知成本（当前必须先下载 1.2GB 权重）
- [ ] **低配置体验档（LFM2.5 230M / 350M ONNX）**
  目的：把首次体验门槛从 1.2GB 降到百 MB 级
  注意：Transformers.js 后端是 prompt-based 生成，**不支持** WebLLM 的 grammar 约束解码（`toolProtocol: "json"` 只对 MLC 档生效）
- [ ] **统计面板（技术密度可视化）**
  数据已就绪：`getStats()`（TTFT / 工具耗时 / 失败率）、`failureLog`（最近 20 条失败原因）
- [ ] **`json` 模式的观感优化（是否要做取决于 P0-2 结论）**
  问题：约束解码下流式输出是 JSON 文本，"思考过程"里看不到自然语言
  思路：只在"工具决策步"用约束解码，最终回答改用自由文本生成（代价是多一次推理）

## 长期 / 需定位决策

- [ ] **P2-1 双后端适配层**：浏览器内置 Prompt API（`availability()` 为 available 时零下载）↔ 自带 WebGPU 模型
  依据：Prompt API 官方 non-goals 明确不保证质量与跨浏览器互操作、可不提供模型、不支持 worker → 自带模型在可控性上仍有结构性优势
- [ ] **P2-3 离线 / 内网发行包 + SRI 校验**
  依据：WebLLM 支持 `integrity`（sha256 校验 config / wasm / tokenizer），可回应第三方镜像的供应链风险
- [ ] **P2-4 浏览器扩展形态 / WebMCP**
  依据：WebLLM 提供扩展示例；WebMCP origin trial（2026-06）在推进"页面向 agent 暴露工具"

## 明确不做

- **不等 WebLLM 原生 `tools` / `tool_choice`**（上游仍标 WIP）→ 用 `json` 约束解码达到等价效果
- **不为 MPA 做 DOM 层兼容** → 正确路径是模型常驻（WebLLM 的 `ServiceWorkerMLCEngine`），但 SDK 未暴露该能力，属上游依赖
- **不做 npm 发布**（定位为技术作品）
- **不做工程治理类扩充**：CHANGELOG / Dependabot / Issue 模板 / coverage 阈值（截至当前定位收益低；LICENSE 已补齐）

## 决策记录

- [x] 项目定位：**技术作品**（优先"效果可见 + 技术密度"，而非可集成性）
- [x] 许可证：**MIT**
- [x] npm 发布：**暂不做**（`package.json` 保持 `private: true`）
- [ ] 默认工具协议：待第 1 批实测结论（当前 `auto → native`）
- [ ] 多模态体积：待定（决定第 5 批是否启动）

## 风险登记

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| `json` 约束解码在三档上是否生效未验证 | 决定协议默认值 | 第 1 批 P0-2c 实测；不生效则回退 `native` |
| native 协议 system prompt 变长（1067 → 2663 字符） | 长期记忆可能被裁到 400 字符 | 回退 `"react"`；或精简 `toolsJson`；或调 `SYSTEM_PROMPT_BUDGET`（注意会动既有预算单测） |
| SW `scope:"/"` 抢占宿主 SW | 嵌入场景影响宿主全站 | 第 2 批 P0-3 |
| 无 WebGPU 设备完全不可用（覆盖率约 85.7%；Safari 26 起才支持、Firefox 仍为 flag） | 约 14% 用户无法使用 | 未排期；候选方案是 wllama（GGUF） |
| 第三方权重镜像的供应链风险 | 权重可能被篡改 | P2-3 的 SRI 校验；README 已声明不重新分发权重 |
