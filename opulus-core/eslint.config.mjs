import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**", "prisma/migrations/**"] },
  js.configs.recommended,
  ...tsPlugin.configs["flat/recommended"],
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          vars: "all",
          args: "after-used",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Services go through repositories; Prisma stays inside them. Use
    // runInTransaction for a transaction boundary.
    files: ["src/services/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "express",
              message: "Services know nothing about HTTP.",
            },
          ],
          patterns: [
            {
              group: ["@prisma/client", "**/client/prisma.js"],
              message:
                "Services use repositories, not Prisma. Use runInTransaction for transactions.",
            },
          ],
        },
      ],
    },
  },
  {
    // Repositories are data access: no Plaid, no coordinating other layers, no HTTP.
    files: ["src/repositories/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "express", message: "Repositories know nothing about HTTP." },
          ],
          patterns: [
            {
              group: ["**/gateways/**", "**/services/**"],
              message:
                "Repositories only use the database. Calling Plaid or other layers belongs in a service.",
            },
          ],
        },
      ],
    },
  },
  {
    // Gateways wrap an external API: no database, no repositories, no HTTP.
    files: ["src/gateways/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "express", message: "Gateways know nothing about HTTP." },
          ],
          patterns: [
            {
              group: ["@prisma/client", "**/client/prisma.js", "**/repositories/**"],
              message: "Gateways don't use the database; a service combines them.",
            },
          ],
        },
      ],
    },
  },
];
