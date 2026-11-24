/**
 * vitest-loader.mjs — 把 `import ... from "vitest"` 重定向到 .tmp 下的垫片。
 *
 * 用法：node --import ./.tmp/shim-register.mjs .tmp/run-unit-shim.mjs
 * 仅用于受限环境下的等价验证，不参与构建与 CI。
 */
export async function resolve(specifier, context, next) {
  if (specifier === "vitest" || specifier === "vitest/config") {
    return {
      url: new URL("./mini-vitest.mjs", import.meta.url).href,
      shortCircuit: true,
      format: "module",
    };
  }
  return next(specifier, context);
}

/** Node 不认识 .css：映射成空模块（这些文件只做视觉样式，逻辑测试不需要） */
export async function load(url, context, next) {
  if (url.endsWith(".css")) {
    return { format: "module", source: "export default {};", shortCircuit: true };
  }
  return next(url, context);
}
