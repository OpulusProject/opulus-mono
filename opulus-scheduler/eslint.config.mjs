import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
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
    // A job is the entry layer, like a controller or a webhook handler: it calls
    // a core service, which holds the work. It doesn't call gateways or Prisma.
    files: ["src/jobs/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@opulus/core",
              importNames: [
                "frankfurterGateway",
                "plaidGateway",
                "prisma",
                "Prisma",
                "PrismaClient",
                "runInTransaction",
              ],
              message:
                "Jobs call core services, not gateways or Prisma. Put the work in a service.",
            },
          ],
        },
      ],
    },
  },
];
