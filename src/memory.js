/**
 * memory.js — 基于 IndexedDB 的记忆系统
 *
 * 两个对象仓库：
 *   - messages: 对话历史（{ id, role, content, timestamp }），跨轮次持久化，
 *     使智能体"记住上一轮对话"。
 *   - memories: 长期事实记忆（{ key, value, timestamp }），用户告知的事实
 *     （如"我叫小明"）可跨会话保留，供 recall_memory 工具检索。
 *
 * 通过 createMemoryStore({ adapter }) 注入存储适配器：
 *   - 浏览器默认使用真实 IndexedDB（adapter 不传）
 *   - Node 单元测试传入内存适配器（tests 内提供）
 */

const DB_NAME = "local-llm-agent";
const DB_VERSION = 1;
const MESSAGES_STORE = "messages";
const MEMORIES_STORE = "memories";
const MAX_HISTORY = 40; // 送入模型的最近消息上限
const MAX_STORAGE_MESSAGES = 200; // 持久化消息上限，超出自动裁剪最旧条目

// ---------------------------------------------------------------------------
// IndexedDB 适配器（浏览器）
// ---------------------------------------------------------------------------

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        const messages = db.createObjectStore(MESSAGES_STORE, { keyPath: "id", autoIncrement: true });
        messages.createIndex("timestamp", "timestamp");
      }
      if (!db.objectStoreNames.contains(MEMORIES_STORE)) {
        db.createObjectStore(MEMORIES_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(db, storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, mode).objectStore(storeName);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const idbAdapter = {
  async init() {
    this._db = await openDb();
  },
  async getAll(store) {
    return tx(this._db, store, "readonly", (s) => s.getAll());
  },
  /** 用索引游标倒序取最近 n 条（避免全表 getAll + 排序） */
  async getRecentFromIndex(store, indexName, n) {
    return new Promise((resolve, reject) => {
      const txObj = this._db.transaction(store, "readonly");
      const idx = txObj.objectStore(store).index(indexName);
      const req = idx.openCursor(null, "prev");
      const results = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor && results.length < n) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          // prev 方向是倒序，反转回升序
          resolve(results.reverse());
        }
      };
      req.onerror = () => reject(req.error);
    });
  },
  async add(store, value) {
    return tx(this._db, store, "readwrite", (s) => s.add(value));
  },
  async put(store, value) {
    return tx(this._db, store, "readwrite", (s) => s.put(value));
  },
  async delete(store, key) {
    return tx(this._db, store, "readwrite", (s) => s.delete(key));
  },
  async clear(store) {
    return tx(this._db, store, "readwrite", (s) => s.clear());
  },
};

// ---------------------------------------------------------------------------
// 内存适配器（Node 单元测试 / 降级兜底）
// ---------------------------------------------------------------------------

export function createMemoryAdapter() {
  const data = { [MESSAGES_STORE]: new Map(), [MEMORIES_STORE]: new Map() };
  let seq = 1;
  return {
    async init() {},
    async getAll(store) {
      return [...data[store].values()];
    },
    async getRecentFromIndex(store, indexName, n) {
      const all = [...data[store].values()].sort((a, b) => (a[indexName] ?? 0) - (b[indexName] ?? 0));
      return all.slice(-n);
    },
    async add(store, value) {
      const id = store === MESSAGES_STORE ? seq++ : value.key;
      const record = { ...value, id };
      data[store].set(id, record);
      return id;
    },
    async put(store, value) {
      data[store].set(store === MESSAGES_STORE ? value.id : value.key, value);
      return value;
    },
    async delete(store, key) {
      data[store].delete(key);
    },
    async clear(store) {
      data[store].clear();
    },
  };
}

// ---------------------------------------------------------------------------
// 记忆 Store 接口
// ---------------------------------------------------------------------------

export class MemoryStore {
  constructor(adapter = null) {
    this.adapter = adapter ?? idbAdapter;
  }

  async init() {
    await this.adapter.init();
  }

  // --- 对话历史 ---

  /** 全部历史消息（按时间升序） */
  async getHistory() {
    const all = await this.adapter.getAll(MESSAGES_STORE);
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  /** 最近 n 条消息（按时间升序返回）—— 优先用索引游标，回退全量加载 */
  async getRecent(n = MAX_HISTORY) {
    if (typeof this.adapter.getRecentFromIndex === "function") {
      try {
        return await this.adapter.getRecentFromIndex(MESSAGES_STORE, "timestamp", n);
      } catch {
        /* 回退到全量加载 */
      }
    }
    const all = await this.getHistory();
    return all.slice(-n);
  }

  async addMessage(role, content) {
    const message = { role, content, timestamp: Date.now() };
    const id = await this.adapter.add(MESSAGES_STORE, message);
    this.trimHistory().catch(() => {});
    return id;
  }

  /** 超过 MAX_STORAGE_MESSAGES 时删除最旧条目，防止持久化无限增长 */
  async trimHistory() {
    try {
      const all = await this.getHistory();
      if (all.length > MAX_STORAGE_MESSAGES) {
        const toRemove = all.slice(0, all.length - MAX_STORAGE_MESSAGES);
        for (const m of toRemove) {
          await this.adapter.delete(MESSAGES_STORE, m.id);
        }
      }
    } catch {
      /* 裁剪失败不影响写入 */
    }
  }

  async clearHistory() {
    return this.adapter.clear(MESSAGES_STORE);
  }

  /** 最近一条用户消息（"记住上一轮对话"的校验点） */
  async lastUserMessage() {
    const all = await this.getHistory();
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].role === "user") return all[i];
    }
    return null;
  }

  // --- 长期记忆 ---

  async saveMemory(key, value) {
    return this.adapter.put(MEMORIES_STORE, { key, value, timestamp: Date.now() });
  }

  async getMemories() {
    return this.adapter.getAll(MEMORIES_STORE);
  }

  async deleteMemory(key) {
    return this.adapter.delete(MEMORIES_STORE, key);
  }

  async clearMemories() {
    return this.adapter.clear(MEMORIES_STORE);
  }

  /** 简单关键词检索：返回与 query 相关的记忆条目 */
  async recall(query) {
    const all = await this.getMemories();
    const q = String(query ?? "").toLowerCase().trim();
    if (!q) return all;
    const terms = q.split(/[\s,，。；;]+/).filter(Boolean);
    return all.filter((m) => {
      const haystack = `${m.key} ${m.value}`.toLowerCase();
      return terms.some((t) => haystack.includes(t));
    });
  }
}

// ---------------------------------------------------------------------------
// 便捷单例（浏览器环境）
// ---------------------------------------------------------------------------

let singleton = null;
export async function getMemoryStore() {
  if (!singleton) {
    singleton = new MemoryStore();
    await singleton.init();
  }
  return singleton;
}

export function resetMemorySingleton() {
  singleton = null;
}
