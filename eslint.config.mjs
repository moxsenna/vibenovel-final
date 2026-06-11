// Flat ESLint config — Sprint 12 Task 12.5.
// Pragmatic baseline for a previously un-linted codebase: errors only for
// high-confidence bugs (e.g. React hook rules); stylistic/uncertain issues are
// warnings so CI can gate on errors without a giant one-time cleanup.
// Non-type-checked on purpose (fast; no parserOptions.project needed).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/dist-node/**",
      "**/build/**",
      "**/node_modules/**",
      "**/.wrangler/**",
      "**/coverage/**",
      "agent-tools/**",
      "test-results/**",
      "playwright-report/**",
      "stitch-reference/**",
      "deploy/**",
      "terminals/**",
      "supabase/**",
      "**/*.config.{js,cjs,mjs,ts}",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // TypeScript handles undefined-symbol resolution; disabling avoids false
  // positives on DOM/Node lib types.
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "prefer-const": "warn",
      // Downgraded to warn (not bugs here): the no-useless-assignment hits are
      // intentional `let x; try { x = … }` init patterns in credit/AI services;
      // the empty-object-type hit is an intentional type-alias interface.
      // Ratchet to error later if desired.
      "no-useless-assignment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  },

  // Web app — browser globals + React hook correctness (errors).
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // Node-side: API, shared package, web e2e/config tooling.
  {
    files: [
      "apps/api/**/*.{ts,mts,cts}",
      "packages/**/*.ts",
      "apps/web/e2e/**/*.ts",
    ],
    languageOptions: { globals: { ...globals.node } },
  },
);
