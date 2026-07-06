import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Non-application directories: the agent harness and process docs are not app
    // source and use their own conventions (CommonJS hooks, etc.). Lint app code only.
    ".claude/**",
    ".codex/**",
    ".agents/**",
    "process/**",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
