// Shared ESLint flat config. Apps and packages re-export it, optionally extended.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/migrations/**",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Architecture rule (docs/ARCHITECTURE.md): packages never import apps.
      "no-restricted-imports": [
        "error",
        { patterns: ["@bas/web", "@bas/web/*", "@bas/worker", "@bas/worker/*"] },
      ],
    },
  },
);
