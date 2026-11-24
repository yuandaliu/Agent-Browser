/**
 * mini-vitest.mjs — vitest 的最小垫片（只用于受限环境下的"等价执行"）
 *
 * 背景：本机沙箱里 vitest 无法启动（vite 加载配置时 esbuild `spawn EPERM`）。
 * 但 tests/unit 下有一批**纯逻辑**测试文件只用到 describe/it/expect/beforeEach/vi.fn，
 * 完全可以在 Node 原生 ESM 下执行。本垫片提供这些 API 的最小实现，配合
 * `vitest-loader.mjs` 把 `import ... from "vitest"` 重定向到这里。
 *
 * 明确不支持：vi.mock / 假定时器 / 快照 / 并发 / 覆盖率。
 * 因此 embed、tools.handlers、devProxy.fallback 等依赖模块级 mock 的文件不在运行清单里。
 *
 * 退场条件：环境恢复（能正常跑 `npm test`）后随 run-unit-shim.mjs 一并删除本目录。
 */
export const registry = { name: "<root>", suites: [], tests: [], beforeEach: [], afterEach: [] };

let current = registry;

export function describe(name, fn) {
  const suite = { name, suites: [], tests: [], beforeEach: [], afterEach: [] };
  current.suites.push(suite);
  const prev = current;
  current = suite;
  try {
    fn();
  } finally {
    current = prev;
  }
}

export function it(name, fn) {
  current.tests.push({ name, fn });
}

export const test = it;

export function beforeEach(fn) {
  current.beforeEach.push(fn);
}

export function afterEach(fn) {
  current.afterEach.push(fn);
}

export function beforeAll(fn) {
  (current.beforeAll ??= []).push(fn);
}

export function afterAll(fn) {
  (current.afterAll ??= []).push(fn);
}

function isObj(v) {
  return v !== null && typeof v === "object";
}

/** 非对称匹配器（expect.stringContaining 等）的标记 */
function asymmetric(kind, sample) {
  return { __asymmetric: kind, sample };
}

function matchAsymmetric(actual, matcher) {
  switch (matcher.__asymmetric) {
    case "stringContaining":
      return typeof actual === "string" && actual.includes(matcher.sample);
    case "stringMatching":
      return typeof actual === "string" && matcher.sample.test(actual);
    case "any":
      return matcher.sample === String
        ? typeof actual === "string"
        : matcher.sample === Number
          ? typeof actual === "number"
          : matcher.sample === Boolean
            ? typeof actual === "boolean"
            : actual instanceof matcher.sample;
    case "objectContaining":
      if (!isObj(actual)) return false;
      return Object.keys(matcher.sample).every((k) => deepEqual(actual[k], matcher.sample[k]));
    default:
      return false;
  }
}

export function deepEqual(a, b) {
  if (isObj(b) && b.__asymmetric) return matchAsymmetric(a, b);
  if (Object.is(a, b)) return true;
  if (!isObj(a) || !isObj(b)) return false;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

function fmt(v) {
  try {
    return typeof v === "string" ? JSON.stringify(v) : (JSON.stringify(v) ?? String(v));
  } catch {
    return String(v);
  }
}

function matchers(actual, negate) {
  const ok = (cond, desc) => {
    if (negate ? cond : !cond) {
      throw new Error(`expect(${fmt(actual)})${negate ? ".not" : ""}.${desc} 不成立`);
    }
  };
  return {
    toBe: (v) => ok(Object.is(actual, v), `toBe(${fmt(v)})`),
    toEqual: (v) => ok(deepEqual(actual, v), `toEqual(${fmt(v)})`),
    toBeNull: () => ok(actual === null, "toBeNull()"),
    toBeUndefined: () => ok(actual === undefined, "toBeUndefined()"),
    toBeDefined: () => ok(actual !== undefined, "toBeDefined()"),
    toBeTruthy: () => ok(Boolean(actual), "toBeTruthy()"),
    toBeFalsy: () => ok(!actual, "toBeFalsy()"),
    toBeTypeOf: (t) => ok(typeof actual === t, `toBeTypeOf(${t})`),
    toBeGreaterThan: (n) => ok(actual > n, `toBeGreaterThan(${n})`),
    toBeGreaterThanOrEqual: (n) => ok(actual >= n, `toBeGreaterThanOrEqual(${n})`),
    toBeLessThan: (n) => ok(actual < n, `toBeLessThan(${n})`),
    toBeLessThanOrEqual: (n) => ok(actual <= n, `toBeLessThanOrEqual(${n})`),
    toHaveLength: (n) => ok(actual?.length === n, `toHaveLength(${n})`),
    toHaveProperty: (pathStr, ...expectedValue) => {
      const parts = String(pathStr).split(".");
      let cur = actual;
      let exists = true;
      for (const p of parts) {
        if (cur === null || cur === undefined || !(p in Object(cur))) {
          exists = false;
          break;
        }
        cur = cur[p];
      }
      if (expectedValue.length > 0) {
        ok(exists && deepEqual(cur, expectedValue[0]), `toHaveProperty(${pathStr}, ${fmt(expectedValue[0])})`);
      } else {
        ok(exists, `toHaveProperty(${pathStr})`);
      }
    },
    toContain: (v) =>
      ok(
        typeof actual === "string"
          ? actual.includes(v)
          : Array.isArray(actual)
            ? actual.some((x) => x === v || deepEqual(x, v))
            : false,
        `toContain(${fmt(v)})`,
      ),
    toMatch: (re) =>
      ok(
        typeof actual === "string" && (re instanceof RegExp ? re.test(actual) : actual.includes(String(re))),
        `toMatch(${re})`,
      ),
    toThrow: (expected) => {
      let threw = false;
      let err = null;
      try {
        actual();
      } catch (e) {
        threw = true;
        err = e;
      }
      let matched = threw;
      if (threw && expected !== undefined) {
        if (typeof expected === "function") {
          // toThrow(ErrorMessage类)：断言 instanceof（vitest 支持传构造函数）
          matched = err instanceof expected;
        } else {
          const msg = String(err?.message ?? err);
          matched = expected instanceof RegExp ? expected.test(msg) : msg.includes(String(expected));
        }
      }
      const desc =
        typeof expected === "function" ? expected.name || "Error" : expected === undefined ? "" : String(expected);
      ok(matched, `toThrow(${desc})`);
    },
    toHaveBeenCalled: () => ok((actual?.mock?.calls?.length ?? 0) > 0, "toHaveBeenCalled()"),
    toHaveBeenCalledTimes: (n) => ok((actual?.mock?.calls?.length ?? -1) === n, `toHaveBeenCalledTimes(${n})`),
    toHaveBeenCalledWith: (...args) =>
      ok((actual?.mock?.calls ?? []).some((c) => deepEqual(c, args)), "toHaveBeenCalledWith(...)"),
  };
}

export function expect(actual) {
  return {
    ...matchers(actual, false),
    not: matchers(actual, true),
    resolves: {
      toBe: async (v) => {
        const got = await actual;
        if (!Object.is(got, v)) throw new Error(`resolves.toBe：实际 ${fmt(got)}`);
      },
      toEqual: async (v) => {
        const got = await actual;
        if (!deepEqual(got, v)) throw new Error(`resolves.toEqual：实际 ${fmt(got)}`);
      },
    },
    rejects: {
      toThrow: async (expected) => {
        let threw = false;
        let err = null;
        try {
          await actual;
        } catch (e) {
          threw = true;
          err = e;
        }
        if (!threw) throw new Error("rejects.toThrow：promise 未 reject");
        if (expected !== undefined) {
          if (typeof expected === "function") {
            if (!(err instanceof expected)) throw new Error(`rejects.toThrow(${expected.name})：类型不匹配`);
            return;
          }
          const msg = String(err?.message ?? err);
          const matched = expected instanceof RegExp ? expected.test(msg) : msg.includes(String(expected));
          if (!matched) throw new Error(`rejects.toThrow(${expected})：实际 ${msg}`);
        }
      },
    },
  };
}

// 非对称匹配器工厂（挂在 expect 上，与 vitest 同名）
expect.stringContaining = (s) => asymmetric("stringContaining", s);
expect.stringMatching = (re) => asymmetric("stringMatching", re);
expect.any = (Ctor) => asymmetric("any", Ctor);
expect.objectContaining = (obj) => asymmetric("objectContaining", obj);

export const vi = {
  fn: (impl) => {
    const calls = [];
    const f = (...args) => {
      calls.push(args);
      return impl ? impl(...args) : undefined;
    };
    f.mock = { calls };
    f.mockClear = () => {
      calls.length = 0;
    };
    f.mockImplementation = (next) => {
      impl = next;
      return f;
    };
    return f;
  },
  spyOn: (obj, key) => {
    const orig = obj[key];
    const f = (...a) => orig.apply(obj, a);
    obj[key] = f;
    return f;
  },
  stubGlobal: (k, v) => {
    globalThis[k] = v;
  },
  unstubAllGlobals: () => {},
  clearAllMocks: () => {},
  useFakeTimers: () => {},
  useRealTimers: () => {},
  advanceTimersByTimeAsync: async () => {},
};
