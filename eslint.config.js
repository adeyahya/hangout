import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-plugin-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import pluginImport from "eslint-plugin-import";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "simple-import-sort": simpleImportSort,
      import: pluginImport,
    },
    rules: {
      "react-refresh/only-export-components": "off",
      "react-hooks/purity": "off",
      // Relax React Compiler-oriented rules for React 18 codebase
      // Disable React Compiler-related rules (we're on React 18)
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "react-hooks/use-memo": "off",
      // Keep type-only imports separate from value imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      // Auto-fixable import hygiene
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            // Side effect imports.
            ["^\\u0000"],
            // Packages. React related packages come first.
            ["^react$", "^react", "^@?\\w"],
            // Internal aliases (e.g. @/*)
            ["^@(/.*|$)"],
            // Parent imports. Put `..` last.
            ["^\.\.(?!/?$)", "^\.\./?$"],
            // Other relative imports. Put same-folder and `.` last.
            ["^\./(?=.*/)(?!/?$)", "^\.(?!/?$)", "^\./?$"],
            // Style imports.
            ["^.+\\.s?css$"],
          ],
        },
      ],
      "simple-import-sort/exports": "error",
      "import/newline-after-import": ["error", { count: 1 }],
      // Allow separate type and value imports from the same module
      "import/no-duplicates": ["error", { "prefer-inline": false }],
      // Soften strict TS empty-object-interface rule to avoid format failures
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: { prettier },
    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
