import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { clearExchangeRates, readExchangeRates } from "../../../shared/fixtures/index.js";
import { failStub, resetStub, stubRequests } from "../helpers/frankfurterStub.js";

const run = promisify(execFile);

/**
 * Run the run-job script the way an operator would. NODE_ENV=production makes
 * the logger write plain JSON straight to stdout, which is all of it (its
 * developer-friendly output is written by another thread and can be cut off
 * when the script exits).
 */
async function runJob(...args: string[]) {
  const repoRoot = path.resolve(process.cwd(), "..");
  try {
    const { stdout, stderr } = await run("pnpm", ["--filter", "@opulus/scheduler", "run-job", ...args], {
      cwd: repoRoot,
      env: { ...process.env, NODE_ENV: "production" },
    });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/**
 * This file: the run-job script, which an operator runs to do a job now, in its
 * own process, without the queue or the scheduler. It runs for real against the
 * test database and the Frankfurter stub.
 *
 * Test cases:
 * - runs the job it is given, and exits 0 once it has stored its result
 * - exits non-zero when the job fails, and stores nothing
 * - says which jobs there are, and does nothing, for a name that is not a job
 * - says the same, and does nothing, when no name is given
 */
test.describe("run-job script", () => {
  test.beforeEach(async ({ request }) => {
    await clearExchangeRates();
    await resetStub(request);
  });

  test("runs the job it is given, and exits 0 once it has stored its result", async ({ request }) => {
    // Act
    const result = await runJob("refresh-exchange-rates");

    // Assert
    expect(result.code).toBe(0);
    expect(result.output).toContain("Job finished");
    expect(await stubRequests(request)).toHaveLength(1);
    expect((await readExchangeRates()).length).toBeGreaterThan(0);
  });

  test("exits non-zero when the job fails, and stores nothing", async ({ request }) => {
    // Arrange
    await failStub(request);

    // Act
    const result = await runJob("refresh-exchange-rates");

    // Assert
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("Job failed");
    expect(await readExchangeRates()).toEqual([]);
  });

  test("says which jobs there are, and does nothing, for a name that is not a job", async ({ request }) => {
    // Act
    const result = await runJob("not-a-job");

    // Assert
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("Usage: run-job <job name>");
    expect(result.output).toContain("refresh-exchange-rates");
    expect(await stubRequests(request)).toEqual([]);
  });

  test("says the same, and does nothing, when no name is given", async ({ request }) => {
    // Act
    const result = await runJob();

    // Assert
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("Usage: run-job <job name>");
    expect(await stubRequests(request)).toEqual([]);
  });
});
