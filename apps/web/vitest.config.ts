import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // CI provides the variables directly.
}

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // auth.test.ts creates and drops its own scratch database.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
