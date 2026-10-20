import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import path from "node:path";

// Evals call real providers, so they need the keys from .env.local.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    include: ["evals/**/*.eval.ts"],
    env: loadEnv("eval", process.cwd(), ""),
  },
});
