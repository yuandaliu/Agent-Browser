/**
 * eslint.config.js — ESLint 9 flat config
 *
 * 规则集设计原则：
 *   - 启用 js.configs.recommended 作为基础
 *   - 关闭会引起大量误报 / 历史代码冲突的风格类规则（no-empty、prefer-const、no-var）
 *   - 自定义：no-unused-vars 允许 _ 前缀（catch err 等场景）
 *   - 测试目录更宽松：完全关闭 no-unused-vars（vitest 的 describe/it 全局函数）
 *
 * 跑法：npm run lint （CI 加 --max-warnings=0 强制零警告）
 */
import js from "@eslint/js";

export default [
  {
    ignores: [
      "node_modules/",
      "dist/",
      "dist-embed/",
      "coverage/",
      "*.esm.js",
      "public/",
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // 浏览器 API（src/embed.js、src/main.js、src/pageReader.js 用到）
        window: "readonly",
        document: "readonly",
        location: "readonly",
        history: "readonly",
        MutationObserver: "readonly",
        NodeFilter: "readonly",
        AbortController: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        // Node API（server/dev-proxy.mjs 用到）
        process: "readonly",
        globalThis: "readonly",
        indexedDB: "readonly", // 浏览器 IndexedDB
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-unreachable": "error",
      // 关闭风格类 / 易误报
      "no-empty": "off",
      "no-constant-condition": "off", // while (!condition) { ... } 类主动 break 模式
      "prefer-const": "off", // embed.js 等地方 let memory = ...; if (...) memory = ... 模式
      "no-var": "off",
      "no-prototype-builtins": "off", // memory.js 可能用到 obj.hasOwnProperty
      "no-useless-escape": "off", // 正则里有 \. \\ 之类
    },
  },
  {
    // 测试文件更宽松：vitest 全局函数 + 测试不需要 strict unused
    files: ["tests/**/*.js", "**/*.test.js"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        vi: "readonly",
        vitest: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-empty": "off",
    },
  },
  {
    // Node ESM 服务端（用 process.argv 等）
    files: ["server/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        globalThis: "readonly",
      },
    },
  },
];
