/**
 * agentLoop.test.js — ReAct 解析器与循环单元测试
 */
import { describe, it, expect } from "vitest";
import { parseReActOutput, extractFinal, buildSystemPrompt, runAgent } from "../../src/agentLoop.js";

describe("extractFinal — 提取最终答案", () => {
  it("标准 Final", () => {
    expect(extractFinal("Thought: 思考\nFinal: 答案是 42")).toBe("答案是 42");
  });

  it("全角冒号", () => {
    expect(extractFinal("Final：现在时间是 3 点")).toBe("现在时间是 3 点");
  });

  it("取最后一个 Final", () => {
    expect(extractFinal("Final: 第一版\nObservation: x\nFinal: 第二版")).toBe("第二版");
  });

  it("无 Final 返回 null", () => {
    expect(extractFinal("Thought: 思考\nAction: get_current_time")).toBeNull();
  });
});

describe("parseReActOutput — ReAct 输出解析", () => {
  it("标准 Action + Action Input（JSON）", () => {
    const parsed = parseReActOutput(
      "Thought: 需要时间\nAction: get_current_time\nAction Input: {}",
    );
    expect(parsed.type).toBe("action");
    expect(parsed.name).toBe("get_current_time");
  });

  it("Action + Action Input 带参数", () => {
    const parsed = parseReActOutput(
      'Thought: 计算\nAction: calculate\nAction Input: {"expression": "12+34"}',
    );
    expect(parsed.type).toBe("action");
    expect(parsed.name).toBe("calculate");
    expect(parsed.input.expression).toBe("12+34");
  });

  it("全角冒号", () => {
    const parsed = parseReActOutput(
      "思考：需要时间\nAction：get_current_time\nAction Input：{}",
    );
    expect(parsed.type).toBe("action");
    expect(parsed.name).toBe("get_current_time");
  });

  it("Action 与 Action Input 之间隔空行", () => {
    const parsed = parseReActOutput("Thought: x\nAction: calculate\n\n\nAction Input: {\"expression\":\"2+3\"}");
    expect(parsed.type).toBe("action");
    expect(parsed.input.expression).toBe("2+3");
  });

  it("JSON 工具调用块", () => {
    const parsed = parseReActOutput('```json\n{"action": "calculate", "action_input": {"expression": "99/11"}}\n```');
    expect(parsed.type).toBe("action");
    expect(parsed.name).toBe("calculate");
    expect(parsed.input.expression).toBe("99/11");
  });

  it("裸值 Action Input 包装为 input", () => {
    const parsed = parseReActOutput('Action: web_search\nAction Input: 今天的天气');
    expect(parsed.type).toBe("action");
    expect(parsed.name).toBe("web_search");
    expect(parsed.input.input).toBe("今天的天气");
  });

  it("Final 优先于未知 Action", () => {
    const parsed = parseReActOutput("Thought: 不知道\nAction: unknown_tool\nAction Input: {}\nFinal: 直接回答");
    expect(parsed.type).toBe("unknown");
    expect(parsed.text).toContain("直接回答");
  });

  it("纯 Final", () => {
    const parsed = parseReActOutput("Final: 现在是下午 3 点");
    expect(parsed.type).toBe("final");
    expect(parsed.text).toBe("现在是下午 3 点");
  });

  it("无格式内容 → unknown（当作直接回答）", () => {
    const parsed = parseReActOutput("你好呀");
    expect(parsed.type).toBe("unknown");
    expect(parsed.text).toBe("你好呀");
  });

  it("Thought 中提及 action 单词不会误判", () => {
    const parsed = parseReActOutput("Thought: I will take action now.\nFinal: 好的");
    expect(parsed.type).toBe("final");
  });
});

describe("buildSystemPrompt — 系统提示词", () => {
  it("包含工具说明与格式指令", () => {
    const prompt = buildSystemPrompt({ toolsDescription: "- get_current_time: 获取时间" });
    expect(prompt).toContain("get_current_time");
    expect(prompt).toContain("Thought:");
    expect(prompt).toContain("Action:");
    expect(prompt).toContain("Action Input:");
    expect(prompt).toContain("Final:");
    expect(prompt).toContain("Observation");
  });

  it("可选注入记忆上下文", () => {
    const prompt = buildSystemPrompt({ toolsDescription: "x", memoryContext: "- name: 小明" });
    expect(prompt).toContain("小明");
  });
});

describe("runAgent — ReAct 循环", () => {
  function createMockMemory(history = []) {
    return {
      getRecent: async () => history,
      recall: async () => [],
      saveMemory: async () => {},
    };
  }

  it("思考→行动→观察→最终回答 的完整循环", async () => {
    const calls = [];
    const generate = async (messages, { onDelta }) => {
      calls.push(messages);
      onDelta?.("…");
      // 第一轮输出 Action，第二轮输出 Final
      const isFirst = messages.filter((m) => m.role === "assistant").length === 0;
      return {
        text: isFirst
          ? "Thought: 需要时间\nAction: get_current_time\nAction Input: {}"
          : "Final: 现在是 15 点 30 分。",
      };
    };

    const events = [];
    const result = await runAgent({
      userInput: "现在几点",
      memory: createMockMemory(),
      generate,
      onStep: (step) => events.push(step.type),
    });

    expect(result.answer).toContain("15 点 30 分");
    expect(events).toContain("action");
    expect(events).toContain("observation");
    expect(events).toContain("final");
    // Observation 被拼回消息并驱动第二轮
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const lastMessages = calls[calls.length - 1];
    expect(lastMessages.some((m) => m.content.includes("Observation:"))).toBe(true);
  });

  it("模型直接输出 Final（无工具）", async () => {
    const result = await runAgent({
      userInput: "你好",
      memory: createMockMemory(),
      generate: async () => ({ text: "Final: 你好！我是本地智能体。" }),
    });
    expect(result.answer).toBe("你好！我是本地智能体。");
  });

  it("工具结果用于回答（计算）", async () => {
    const generate = async (messages) => {
      const isFirst = messages.filter((m) => m.role === "assistant").length === 0;
      return {
        text: isFirst
          ? 'Thought: 计算\nAction: calculate\nAction Input: {"expression": "12*34"}'
          : "Final: 12 乘以 34 等于 408。",
      };
    };
    const events = [];
    const result = await runAgent({
      userInput: "12*34 是多少",
      memory: createMockMemory(),
      generate,
      onStep: (step) => events.push(step),
    });
    const observation = events.find((e) => e.type === "observation");
    expect(observation.result).toBe("12*34 = 408");
    expect(result.answer).toContain("408");
  });

  it("超过最大步数终止循环", async () => {
    // 每轮输出不同工具（避免触发死循环保护），但始终不输出 Final
    const actions = ["get_current_time", "calculate", "web_search", "recall_memory", "save_memory"];
    let call = 0;
    const generate = async () => {
      const name = actions[call++ % actions.length];
      return { text: `Thought: x\nAction: ${name}\nAction Input: {}` };
    };
    const result = await runAgent({
      userInput: "测试",
      memory: createMockMemory(),
      generate,
      maxSteps: 3,
    });
    expect(result.answer).toContain("多次");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("max_steps");
  });

  it("相同 Action 连续出现 3 次触发死循环保护", async () => {
    const generate = async () => ({ text: "Thought: x\nAction: get_current_time\nAction Input: {}" });
    const result = await runAgent({
      userInput: "测试",
      memory: createMockMemory(),
      generate,
      maxSteps: 6,
    });
    expect(result.answer).toContain("连续");
    expect(result.answer).toContain("停止尝试");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("loop");
  });

  it("连续第 2 次调用同一工具时注入换工具引导", async () => {
    const calls = [];
    const generate = async (messages) => {
      calls.push(messages);
      return { text: "Thought: x\nAction: recall_memory\nAction Input: {\"query\":\"读取当前页面内容\"}" };
    };
    const result = await runAgent({
      userInput: "读取当前页面内容",
      memory: createMockMemory(),
      generate,
      maxSteps: 5,
    });
    // 第 3 次生成的消息中应包含换工具引导（第 2 次重复后注入，取最后一条 Observation）
    const thirdMessages = calls[2];
    const observations = thirdMessages.filter((m) => m.content.includes("Observation"));
    const lastObservation = observations[observations.length - 1];
    expect(lastObservation.content).toContain("换一个更合适的工具");
    expect(lastObservation.content).toContain("read_page_content");
    // 第 3 次调用（count>=2）触发终止
    expect(result.answer).toContain("停止尝试");
  });

  it("recall_memory 无结果时引导使用 read_page_content（模型换工具场景）", async () => {
    const generate = async (messages) => {
      const hasHint = messages.some((m) => m.content.includes("换一个更合适的工具"));
      const triedRead = messages.some((m) => m.role === "assistant" && m.content.includes("read_page_content"));
      if (triedRead) return { text: "Final: 这个页面是本地智能搜索页面。" };
      if (hasHint) return { text: 'Thought: 换工具\nAction: read_page_content\nAction Input: {}' };
      return { text: 'Thought: 回忆\nAction: recall_memory\nAction Input: {"query":"读取当前页面内容"}' };
    };
    const events = [];
    const result = await runAgent({
      userInput: "读取当前页面内容",
      memory: createMockMemory(),
      generate,
      onStep: (s) => events.push(s),
    });
    const actions = events.filter((e) => e.type === "action").map((e) => e.name);
    expect(actions).toContain("recall_memory");
    expect(actions).toContain("read_page_content");
    expect(result.answer).toBe("这个页面是本地智能搜索页面。");
    expect(result.answer).not.toContain("停止尝试");
  });

  it("模型生成异常时返回错误信息", async () => {
    const result = await runAgent({
      userInput: "测试",
      memory: createMockMemory(),
      generate: async () => {
        throw new Error("engine crashed");
      },
    });
    expect(result.answer).toContain("engine crashed");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("error");
  });

  it("正常完成的回答标记 ok=true", async () => {
    const result = await runAgent({
      userInput: "你好",
      memory: createMockMemory(),
      generate: async () => ({ text: "Final: 你好！我是本地智能体。" }),
    });
    expect(result.ok).toBe(true);
  });

  it("历史消息注入最近对话（记住上一轮）", async () => {
    const history = [
      { role: "user", content: "我叫小明", timestamp: 1 },
      { role: "assistant", content: "好的，记住了", timestamp: 2 },
    ];
    let captured = null;
    const generate = async (messages) => {
      captured = messages;
      return { text: "Final: 你叫小明。" };
    };
    await runAgent({
      userInput: "我叫什么",
      memory: createMockMemory(history),
      generate,
    });
    expect(captured.some((m) => m.role === "user" && m.content === "我叫小明")).toBe(true);
    expect(captured.some((m) => m.role === "system")).toBe(true);
  });
});
