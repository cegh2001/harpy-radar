import tseslint from "typescript-eslint";
import vitest from "eslint-plugin-vitest";
import reactHooks from "eslint-plugin-react-hooks";

const ALLOWED_SCHEMA_BARREL = ["src/db/schema/index.ts"];

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      ".tokensave/**",
      ".agents/**",
      ".atl/**",
      ".engram/**",
      "dist/**",
      "coverage/**",
      "**/*.d.ts",
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.{js,mjs,ts}"],
    rules: {
      "max-lines": [
        "error",
        {
          max: 350,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportAllDeclaration",
          message:
            "Wildcard exports (`export * from '...'`) are forbidden. Use explicit named imports/exports to preserve tree-shaking and reduce AST token resolution.",
        },
      ],
    },
  },
  {
    files: ALLOWED_SCHEMA_BARREL,
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: [
      "tests/**/*.{test,spec}.{ts,tsx}",
      "src/**/*.{test,spec}.{ts,tsx}",
    ],
    plugins: {
      vitest,
    },
    rules: {
      "vitest/no-restricted-matchers": [
        "error",
        {
          toBeTruthy:
            "Shallow assertion `toBeTruthy()` is forbidden. Assert exact return values, deep equality (`toStrictEqual`), or specific boolean states.",
          toBeDefined:
            "Shallow assertion `toBeDefined()` is forbidden. Assert exact return payloads, types, or expected shapes.",
        },
      ],
      "vitest/no-identical-title": "error",
    },
  }
);
