// ESLint flat config for hex-relay (TS / ESM / Node 24+)
// Generated per ln-741-linter-configurator skill.
// Format: eslint.config.ts (jiti loader resolves it on Node < 22.10).

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import unicorn from "eslint-plugin-unicorn";

const configDir = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: ["dist/", "build/", "node_modules/", "coverage/", "*.tsbuildinfo"],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.ts"],
        },
        tsconfigRootDir: configDir,
      },
    },
  },

  unicorn.configs.recommended,

  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],

      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true },
      ],

      // Domain uses null natively (SQLite NULL, optional FKs).
      "unicorn/no-null": "off",

      // Identifiers like tgChatId/dbPath/cmdFile are intentional.
      "unicorn/prevent-abbreviations": "off",

      // src/index.ts exits intentionally on fatal bootstrap errors.
      "unicorn/no-process-exit": "off",

      // ESM already; rule misfires on .d.ts patterns.
      "unicorn/prefer-module": "off",

      // Project convention: camelCase filenames with .service/.routes/.worker suffixes.
      "unicorn/filename-case": "off",

      // Named ESM imports (e.g. `import { join } from "node:path"`) are idiomatic here.
      "unicorn/import-style": "off",

      // Common pattern: `.map(fn)`, `.filter(Boolean)`. Strict version is too noisy.
      "unicorn/no-array-callback-reference": "off",

      // Array#toSorted/toReversed require ES2023; project targets ES2022.
      "unicorn/no-array-sort": "off",
      "unicorn/no-array-reverse": "off",

      // Top-level await would force restructuring index.ts bootstrap; not worth it.
      "unicorn/prefer-top-level-await": "off",

      // Helper hoisting opinion clashes with locality preference in some places.
      "unicorn/consistent-function-scoping": "off",
    },
  },

  // Test files — disable type-checked rules (vitest tsconfig may exclude them).
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "tests/**/*.ts"],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "no-console": "off",
    },
  },

  eslintConfigPrettier
);
