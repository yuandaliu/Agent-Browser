/**
 * shim-register.mjs — 注册 vitest-loader（Node 20+ 的 module.register）
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./vitest-loader.mjs", pathToFileURL(import.meta.filename).href);
