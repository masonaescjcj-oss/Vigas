import { defineConfig } from "vitest/config";

// Inline (empty) PostCSS config so Vite does not try to load the frontend's
// CommonJS postcss.config.js, which fails under "type": "module".
export default defineConfig({
  css: { postcss: {} },
  test: {
    include: ["src/core/agent/__tests__/**/*.test.ts"],
  },
});
