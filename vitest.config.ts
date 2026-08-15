import { defineConfig } from "vitest/config";

// Inline (empty) PostCSS config so Vite does not try to load the frontend's
// CommonJS postcss.config.js, which fails under "type": "module".
export default defineConfig({
  css: { postcss: {} },
  test: {
    // Agent core + the pure frontend logic (preview building, message parsing,
    // file/date formatting). UI components themselves aren't rendered here.
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
