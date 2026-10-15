import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { findConfigProblems } from "@opulus/core";

const run = promisify(execFile);

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

/** Start a service the way `pnpm dev` does, in production, with only the given environment. */
async function startService(service: "backend" | "webhooks" | "scheduler", env: Record<string, string>) {
  const repoRoot = path.resolve(process.cwd(), "..");
  try {
    await run("pnpm", ["--filter", `@opulus/${service}`, "exec", "tsx", "src/server.ts"], {
      cwd: repoRoot,
      // No .env: a developer's own file must not fill in what the test leaves out.
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NODE_ENV: "production", DOTENV_CONFIG_PATH: "/nonexistent/.env", ...env },
      timeout: 60_000,
    });
    return { code: 0, output: "" };
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/**
 * This file: a service refuses to start in production with a missing or
 * placeholder setting (and says which), instead of starting and failing later
 * and elsewhere. The rules are checked directly; the refusal is checked by
 * starting each real service with an empty environment.
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
      const result = await startService(service, {});

      expect(result.code).toBe(1);
      expect(result.output).toContain(`The ${service} service cannot start`);
      expect(result.output).toContain("DATABASE_URL is not set");
    });
  }
});
