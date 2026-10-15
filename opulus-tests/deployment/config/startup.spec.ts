import { expect, test } from "@playwright/test";
import { findConfigProblems } from "@opulus/core";
import { exited, startService, stopService } from "../helpers/service.js";

/** An environment that is complete for every service. */
const GOOD_ENV = {
  DATABASE_URL: "postgresql://app:pw@db:5432/app",
  BETTER_AUTH_SECRET: "a-real-secret-that-is-at-least-32-chars-long",
  BETTER_AUTH_BASE_URL: "https://api.example.test",
  CLIENT_URL: "https://www.example.test",
  PLAID_CLIENT_ID: "plaid-client",
  PLAID_SECRET: "plaid-secret",
  PLAID_ENV: "production",
  REDIS_HOST: "redis.internal",
};

const PORTS = { backend: 18297, webhooks: 18298, scheduler: 18299 };
const PORT_VARIABLES = { backend: "PORT", webhooks: "WEBHOOK_PORT", scheduler: "SCHEDULER_PORT" };

/**
 * Start a service the way `pnpm dev` does, in production, with only the given
 * environment. No .env either: a developer's own file must not fill in what the
 * spec leaves out.
 */
async function startInProduction(service: "backend" | "webhooks" | "scheduler", env: Record<string, string>) {
  const running = await startService({
    workspace: `opulus-${service}`,
    port: PORTS[service],
    portVariable: PORT_VARIABLES[service],
    cleanEnv: true,
    env: { NODE_ENV: "production", DOTENV_CONFIG_PATH: "/nonexistent/.env", ...env },
    waitMs: 20_000,
  });
  const code = await exited(running.child, 20_000).catch(() => null);
  const output = running.output();
  await stopService(running);
  return { code, output };
}

/**
 * This file: a service refuses to start in production with a missing or
 * placeholder setting (and says which), instead of starting and failing later
 * and elsewhere. The rules (`findConfigProblems`, a pure function of core, so
 * these first specs start nothing) are checked directly; the refusal is checked
 * by starting each real service with an empty environment.
 */
test.describe("configuration is checked at startup", () => {
  test("a complete environment has no problems, for every service", () => {
    for (const service of ["backend", "webhooks", "scheduler"] as const) {
      expect(findConfigProblems(service, GOOD_ENV)).toEqual([]);
    }
  });

  test("the backend needs a database, a real session secret, an https base URL, the client origin and Plaid", () => {
    const problems = findConfigProblems("backend", {});

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("DATABASE_URL"),
        expect.stringContaining("BETTER_AUTH_SECRET"),
        expect.stringContaining("BETTER_AUTH_BASE_URL"),
        expect.stringContaining("CLIENT_URL"),
        expect.stringContaining("PLAID_CLIENT_ID"),
        expect.stringContaining("PLAID_SECRET"),
        expect.stringContaining("PLAID_ENV"),
      ]),
    );
    // Redis is not the backend's: it is not asked for.
    expect(problems.join()).not.toContain("REDIS_HOST");
  });

  test("a short or placeholder secret is refused", () => {
    for (const secret of ["short", "replace-me-with-a-local-secret-0123456789", ""]) {
      expect(
        findConfigProblems("backend", { ...GOOD_ENV, BETTER_AUTH_SECRET: secret }).join(),
      ).toContain("BETTER_AUTH_SECRET");
    }
  });

  test("a base URL that is not https, and a Plaid environment that is not sandbox or production, are refused", () => {
    const problems = findConfigProblems("backend", {
      ...GOOD_ENV,
      BETTER_AUTH_BASE_URL: "http://api.example.test",
      PLAID_ENV: "development",
    });

    expect(problems.join()).toContain("https://");
    expect(problems.join()).toContain('PLAID_ENV must be "sandbox" or "production"');
  });

  test("placeholder Plaid credentials are refused", () => {
    expect(
      findConfigProblems("backend", { ...GOOD_ENV, PLAID_CLIENT_ID: "replace-me" }).join(),
    ).toContain("PLAID_CLIENT_ID");
  });

  test("the webhook receiver needs Plaid and Redis, the scheduler only Redis", () => {
    expect(findConfigProblems("webhooks", { DATABASE_URL: "x" }).join()).toEqual(
      expect.stringMatching(/PLAID_CLIENT_ID[\s\S]*REDIS_HOST|REDIS_HOST[\s\S]*PLAID_CLIENT_ID/),
    );
    expect(findConfigProblems("scheduler", { DATABASE_URL: "x" })).toEqual([
      expect.stringContaining("REDIS_HOST"),
    ]);
  });

  for (const service of ["backend", "webhooks", "scheduler"] as const) {
    test(`the ${service} refuses to start in production with nothing configured, and says what is missing`, async () => {
      const result = await startInProduction(service, {});

      expect(result.code).toBe(1);
      expect(result.output).toContain(`The ${service} service cannot start`);
      expect(result.output).toContain("DATABASE_URL is not set");
    });
  }
});
