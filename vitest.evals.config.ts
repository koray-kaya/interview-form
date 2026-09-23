// A second Vitest project for the prompt evals only. They call a real model,
// so they live outside `npm test`: node environment, no jsdom, and a long
// timeout. The gateway key comes from .env.local, which the npm script hands
// to node with --env-file-if-exists, the same way `npm run export` does it.
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    // one model call at a time: the evals are about the prompt, not throughput
    fileParallelism: false,
    testTimeout: 120_000,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
