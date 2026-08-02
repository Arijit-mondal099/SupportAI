import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: [
      "node_modules",
      ".next",
      "dist",
      "src/components/ui",
      "src/components/dashboard",
      "src/hooks",
    ],
    setupFiles: ["./src/tests/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/lib", "src/app/api"],
      exclude: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)", "src/tests/**"],
      all: false,
    },
  },
});
