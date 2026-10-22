import { expect, test } from "@playwright/test";
import { findConfigProblems } from "@opulus/core";

const KEY = Buffer.alloc(32, 7).toString("base64");
const SECRET = "a-real-looking-secret-of-32-chars-or-more!";

const complete = {
  DATABASE_URL: "postgresql://app:pw@db:5432/app",
  BETTER_AUTH_SECRET: SECRET,
  BETTER_AUTH_BASE_URL: "https://api.example.test",
  CLIENT_URL: "https://app.example.test",
  PLAID_CLIENT_ID: "client",
  PLAID_SECRET: "secret",
  PLAID_ENV: "production",
  ITEM_TOKEN_ENCRYPTION_KEY: KEY,
  REDIS_HOST: "redis.internal",
};

/** What `findConfigProblems` says about `env` for a service, without the parts of the sentence a test need not repeat. */
const problems = (service: "backend" | "webhooks" | "scheduler", env: Record<string, string | undefined>) =>
  findConfigProblems(service, env);

/**
 * What each service needs in its environment to start in production
 * (opulus-core/src/config/validate.ts). deployment/config proves a service
 * really refuses to start; this is the service-by-variable table behind it.
 *
 * Test cases:
 * - a complete environment has no problems for any service
 * - every service needs DATABASE_URL
 * - the backend needs a real session secret of 32+ characters, an https base URL, the client URL, Plaid credentials and the item-token key
 * - the webhooks service needs Plaid credentials, the item-token key and Redis, but not the backend's session settings
 * - the scheduler needs only the database and Redis
 * - the scheduler's SECURITY_PRICES_INTERVAL_MINUTES, when set, must be a whole number of minutes from 1 to 1440
 * - a placeholder from .env.example does not count as set
 * - PLAID_ENV must be sandbox or production
 * - all the problems are reported at once
 */
test.describe("config problems", () => {
  test("a complete environment has no problems for any service", () => {
    for (const service of ["backend", "webhooks", "scheduler"] as const) {
      expect(problems(service, complete)).toEqual([]);
    }
  });

  test("every service needs DATABASE_URL", () => {
    for (const service of ["backend", "webhooks", "scheduler"] as const) {
      expect(problems(service, { ...complete, DATABASE_URL: undefined })).toContain("DATABASE_URL is not set");
      expect(problems(service, { ...complete, DATABASE_URL: "  " })).toContain("DATABASE_URL is not set");
    }
  });

  test("the backend needs a real session secret of 32+ characters, an https base URL, the client URL, Plaid credentials and the item-token key", () => {
    const backend = (env: Record<string, string | undefined>) => problems("backend", { ...complete, ...env }).join("\n");

    expect(backend({ BETTER_AUTH_SECRET: "short" })).toContain("BETTER_AUTH_SECRET");
    expect(backend({ BETTER_AUTH_SECRET: "x".repeat(31) })).toContain("BETTER_AUTH_SECRET");
    expect(backend({ BETTER_AUTH_SECRET: "x".repeat(32) })).toBe("");
    expect(backend({ BETTER_AUTH_SECRET: undefined })).toContain("BETTER_AUTH_SECRET");
    expect(backend({ BETTER_AUTH_BASE_URL: undefined })).toContain("BETTER_AUTH_BASE_URL is not set");
    expect(backend({ BETTER_AUTH_BASE_URL: "http://api.example.test" })).toContain("must be an https:// URL");
    expect(backend({ CLIENT_URL: undefined })).toContain("CLIENT_URL is not set");
    expect(backend({ PLAID_CLIENT_ID: undefined })).toContain("PLAID_CLIENT_ID is not set");
    expect(backend({ PLAID_SECRET: "" })).toContain("PLAID_SECRET is not set");
    expect(backend({ ITEM_TOKEN_ENCRYPTION_KEY: undefined })).toContain("ITEM_TOKEN_ENCRYPTION_KEY");
    expect(backend({ ITEM_TOKEN_ENCRYPTION_KEY: "not-a-key" })).toContain("ITEM_TOKEN_ENCRYPTION_KEY");
  });

  test("the webhooks service needs Plaid credentials, the item-token key and Redis, but not the backend's session settings", () => {
    const sessionOnly = { BETTER_AUTH_SECRET: undefined, BETTER_AUTH_BASE_URL: undefined, CLIENT_URL: undefined };

    expect(problems("webhooks", { ...complete, ...sessionOnly })).toEqual([]);
    expect(problems("webhooks", { ...complete, PLAID_SECRET: undefined })).toEqual(["PLAID_SECRET is not set"]);
    expect(problems("webhooks", { ...complete, ITEM_TOKEN_ENCRYPTION_KEY: undefined })).toHaveLength(1);
    expect(problems("webhooks", { ...complete, REDIS_HOST: undefined })).toHaveLength(1);
    expect(problems("webhooks", { ...complete, REDIS_HOST: undefined })[0]).toContain("REDIS_HOST");
  });

  test("the scheduler needs only the database and Redis", () => {
    const nothingElse = { DATABASE_URL: complete.DATABASE_URL, REDIS_HOST: complete.REDIS_HOST };

    expect(problems("scheduler", nothingElse)).toEqual([]);
    expect(problems("scheduler", { DATABASE_URL: complete.DATABASE_URL })).toHaveLength(1);
  });

  test("the scheduler's SECURITY_PRICES_INTERVAL_MINUTES, when set, must be a whole number of minutes from 1 to 1440", () => {
    const scheduler = { DATABASE_URL: complete.DATABASE_URL, REDIS_HOST: complete.REDIS_HOST };

    for (const fine of [undefined, "", "1", "15", "1440"]) {
      expect(problems("scheduler", { ...scheduler, SECURITY_PRICES_INTERVAL_MINUTES: fine })).toEqual([]);
    }
    expect(problems("scheduler", { ...scheduler, SECURITY_PRICES_INTERVAL_MINUTES: "soon" })[0]).toContain("must be a whole number");
    expect(problems("scheduler", { ...scheduler, SECURITY_PRICES_INTERVAL_MINUTES: "7.5" })[0]).toContain("must be a whole number");
    expect(problems("scheduler", { ...scheduler, SECURITY_PRICES_INTERVAL_MINUTES: "0" })[0]).toContain("from 1 to 1440");
    expect(problems("scheduler", { ...scheduler, SECURITY_PRICES_INTERVAL_MINUTES: "1441" })[0]).toContain("from 1 to 1440");
    // Not a setting of the other services.
    expect(problems("webhooks", { ...complete, SECURITY_PRICES_INTERVAL_MINUTES: "soon" })).toEqual([]);
  });

  test("a placeholder from .env.example does not count as set", () => {
    expect(problems("backend", { ...complete, PLAID_SECRET: "replace-me" })).toEqual(["PLAID_SECRET is not set"]);
    expect(problems("backend", { ...complete, PLAID_CLIENT_ID: "Replace-Me-please" })).toEqual(["PLAID_CLIENT_ID is not set"]);
    expect(problems("backend", { ...complete, BETTER_AUTH_SECRET: "replace-me-with-something-32-chars-long!!" })).toHaveLength(1);
  });

  test("PLAID_ENV must be sandbox or production", () => {
    expect(problems("backend", { ...complete, PLAID_ENV: "sandbox" })).toEqual([]);
    expect(problems("backend", { ...complete, PLAID_ENV: "development" })[0]).toContain('PLAID_ENV must be "sandbox" or "production"');
    expect(problems("backend", { ...complete, PLAID_ENV: undefined })[0]).toContain("PLAID_ENV");
  });

  test("all the problems are reported at once", () => {
    const found = problems("backend", {});

    expect(found.length).toBeGreaterThanOrEqual(7);
    expect(found).toContain("DATABASE_URL is not set");
    expect(found).toContain("PLAID_CLIENT_ID is not set");
  });
});
