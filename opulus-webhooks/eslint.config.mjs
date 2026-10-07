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
    // Services (the webhooks service's own business logic) go through
    // repositories, like the backend's: no Prisma, no HTTP.
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
              message: "Services know nothing about HTTP.",
            },
          ],
        },
      ],
    },
  },
  {
    // Webhook handlers are the entry layer, like controllers: read the event and
    // call a service. They don't call Plaid or Prisma themselves.
    files: ["src/plaid/handlers/**/*.ts"],
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
                "Handlers call services, not gateways or Prisma. Put the work in a service.",
            },
          ],
        },
      ],
    },
  },
];
