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
              name: "@opulus/core",
              importNames: ["prisma", "Prisma", "PrismaClient"],
              message:
                "Services use repositories, not Prisma. Use runInTransaction for transactions.",
            },
            {
              name: "express",
              message: "Services know nothing about HTTP; keep req and res in controllers.",
            },
          ],
        },
      ],
    },
  },
  {
    // Controllers handle HTTP only: they call services (or one repository for a
    // plain read), never Plaid, Prisma or a transaction.
    files: ["src/controllers/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@opulus/core",
              importNames: [
                "plaidGateway",
                "prisma",
                "Prisma",
                "PrismaClient",
                "runInTransaction",
              ],
              message:
                "Controllers call services, not gateways or Prisma. Put the work in a service.",
            },
          ],
        },
      ],
    },
  },
];
