/**
 * memory.test.js — 记忆系统单元测试（内存适配器）
 */
import { describe, it, expect } from "vitest";
import { MemoryStore, createMemoryAdapter } from "../../src/memory.js";

async function createStore() {
  const store = new MemoryStore(createMemoryAdapter());
  await store.init();
  return store;
}

describe("MemoryStore — 对话历史", () => {
  it("保存并按时间顺序返回消息", async () => {
    const store = await createStore();
    await store.addMessage("user", "你好");
    await store.addMessage("assistant", "你好呀");
    const history = await store.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe("user");
    expect(history[1].role).toBe("assistant");
    expect(history[1].content).toBe("你好呀");
  });

  it("getRecent 只返回最近 n 条", async () => {
    const store = await createStore();
    for (let i = 0; i < 10; i++) await store.addMessage("user", `消息${i}`);
    const recent = await store.getRecent(3);
    expect(recent).toHaveLength(3);
    expect(recent[2].content).toBe("消息9");
  });

  it("lastUserMessage 返回最近一条用户消息（记住上一轮对话）", async () => {
    const store = await createStore();
    await store.addMessage("user", "第一句");
    await store.addMessage("assistant", "回复1");
    await store.addMessage("user", "第二句");
    const last = await store.lastUserMessage();
    expect(last.content).toBe("第二句");
  });

  it("clearHistory 清空对话", async () => {
    const store = await createStore();
    await store.addMessage("user", "x");
    await store.clearHistory();
    expect(await store.getHistory()).toHaveLength(0);
  });
});

describe("MemoryStore — 长期记忆", () => {
  it("saveMemory / getMemories / 覆盖写入", async () => {
    const store = await createStore();
    await store.saveMemory("name", "小明");
    await store.saveMemory("preference", "咖啡");
    const memories = await store.getMemories();
    expect(memories).toHaveLength(2);
    // 覆盖
    await store.saveMemory("name", "小红");
    const updated = await store.getMemories();
    expect(updated.find((m) => m.key === "name").value).toBe("小红");
  });

  it("recall 按关键词检索", async () => {
    const store = await createStore();
    await store.saveMemory("name", "小明");
    await store.saveMemory("city", "北京");
    const hit = await store.recall("name");
    expect(hit.some((m) => m.key === "name")).toBe(true);
    const hitZh = await store.recall("明");
    expect(hitZh.some((m) => m.key === "name")).toBe(true);
    const miss = await store.recall("不存在的关键词");
    expect(miss).toHaveLength(0);
    // 空 query 返回全部
    expect(await store.recall("")).toHaveLength(2);
  });

  it("deleteMemory 删除单条", async () => {
    const store = await createStore();
    await store.saveMemory("a", "1");
    await store.saveMemory("b", "2");
    await store.deleteMemory("a");
    const memories = await store.getMemories();
    expect(memories).toHaveLength(1);
    expect(memories[0].key).toBe("b");
  });
});
