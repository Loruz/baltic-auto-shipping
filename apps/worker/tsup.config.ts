import { defineConfig } from "tsup";

// Workspace packages ship TypeScript source, so they are bundled in; npm deps stay external.
export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  clean: true,
  sourcemap: true,
  noExternal: [/^@bas\//],
});
