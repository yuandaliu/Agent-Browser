/**
 * failureLog.test.js — 失败对话持久化单元测试
 *
 * 使用内存适配器（不依赖 localStorage），保证 Node 单测可跑。
 */
import { describe, it, expect, beforeEach } from "vitest";
import { FailureLog, STORAGE_KEY, MAX_FAILURES } from "../../src/failureLog.js";

/** 测试用内存适配器（等价于 localStorage 的最小子集） */
function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

describe("FailureLog — 失败对话持久化", () => {
  let storage;
  let log;

  beforeEach(() => {
    storage = createMemoryStorage();
    log = new FailureLog(storage);
  });

  it("record 写入后能从 getAll 取回", () => {
    const entry = log.record({ userInput: "测试", ok: false, reason: "loop", answer: "失败" });
    expect(entry).not.toBeNull();
    expect(entry.userInput).toBe("测试");
    expect(entry.timestamp).toBeTypeOf("number");
    const all = log.getAll();
    expect(all.length).toBe(1);
    expect(all[0].userInput).toBe("测试");
  });

  it("多条记录按时间升序返回", () => {
    log.record({ userInput: "1", ok: false, reason: "loop" });
    log.record({ userInput: "2", ok: false, reason: "error" });
    log.record({ userInput: "3", ok: false, reason: "max_steps" });
    const all = log.getAll();
    expect(all.map((e) => e.userInput)).toEqual(["1", "2", "3"]);
  });

  it("last() 返回最新一条", () => {
    log.record({ userInput: "first", ok: false, reason: "loop" });
    log.record({ userInput: "latest", ok: false, reason: "error" });
    expect(log.last().userInput).toBe("latest");
  });

  it("空记录时 last() 返回 null", () => {
    expect(log.last()).toBeNull();
  });

  it(`超过 MAX_FAILURES（${MAX_FAILURES}）时自动裁剪最旧（FIFO）`, () => {
    for (let i = 0; i < MAX_FAILURES + 5; i++) {
      log.record({ userInput: `entry-${i}`, ok: false, reason: "loop" });
    }
    const all = log.getAll();
    expect(all.length).toBe(MAX_FAILURES);
    // 保留最新 20 条：entry-0 到 entry-4 应被删除，entry-5 是最旧
    expect(all[0].userInput).toBe("entry-5");
    expect(all[all.length - 1].userInput).toBe(`entry-${MAX_FAILURES + 4}`);
  });

  it("clear 清空全部记录", () => {
    log.record({ userInput: "x", ok: false, reason: "error" });
    log.record({ userInput: "y", ok: false, reason: "loop" });
    expect(log.size()).toBe(2);
    log.clear();
    expect(log.size()).toBe(0);
    expect(log.getAll()).toEqual([]);
  });

  it("损坏的 JSON 降级为空（不抛错）", () => {
    storage.setItem(STORAGE_KEY, "{not valid json");
    expect(log.size()).toBe(0);
    expect(log.getAll()).toEqual([]);
  });

  it("非数组数据降级为空（防止意外结构）", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ foo: "bar" }));
    expect(log.getAll()).toEqual([]);
  });

  it("storage 抛错时 record 静默降级（不阻断主流程）", () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
      removeItem: () => {},
    };
    const log2 = new FailureLog(broken);
    const result = log2.record({ userInput: "x", ok: false, reason: "error" });
    expect(result).toBeNull();
  });

  it("storage 抛错时 getAll 静默降级为空数组", () => {
    const broken = {
      getItem: () => {
        throw new Error("read fail");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    const log2 = new FailureLog(broken);
    expect(log2.getAll()).toEqual([]);
    expect(log2.size()).toBe(0);
    expect(log2.last()).toBeNull();
  });

  it("可选字段缺失时不报错", () => {
    const entry = log.record({ userInput: "minimal", ok: false });
    expect(entry.userInput).toBe("minimal");
    expect(entry.ok).toBe(false);
    expect(entry.timestamp).toBeTypeOf("number");
  });

  it("持久化到相同 STORAGE_KEY：跨实例读取", () => {
    const log1 = new FailureLog(storage);
    log1.record({ userInput: "持久化测试", ok: false, reason: "loop" });
    const log2 = new FailureLog(storage);
    expect(log2.size()).toBe(1);
    expect(log2.getAll()[0].userInput).toBe("持久化测试");
  });
});
