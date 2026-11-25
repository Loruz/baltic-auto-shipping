import base from "@bas/config/eslint";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

export default [
  ...base,
  {
    plugins: { "@next/next": nextPlugin },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
];
