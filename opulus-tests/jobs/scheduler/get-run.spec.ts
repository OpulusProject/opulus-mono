import { expect, test } from "@playwright/test";
import { JobRunResponseSchema } from "@opulus/core";
import { expectMatchesSchema, expectStatus } from "../../shared/assertions.js";
import { clearExchangeRates } from "../../shared/fixtures/index.js";
import { failStub, resetStub } from "./helpers/frankfurterStub.js";
import { startRun, waitForRun, withAdminToken } from "./helpers/scheduler.js";

/**
 * This file: GET /jobs/:name/runs/:id, a run's state, attempts, result or
 * error. Only there with SCHEDULER_ADMIN_TOKEN, and needs that token.
 */
test.describe("GET /jobs/:name/runs/:id", () => {
  test.beforeEach(async ({ request }) => {
    await clearExchangeRates();
    await resetStub(request);
  });

  test("requires the admin token (401)", async ({ request }) => {
    const run = await startRun(request, "refresh-exchange-rates");
    const res = await request.get(
      `/jobs/refresh-exchange-rates/runs/${run.id}`,
    );
    await expectStatus(res, 401);
    expect((await res.json()).error).toBe("Unauthorized");
    // Let the run finish, so it cannot write after the next test clears the table.
    await waitForRun(request, run.job, run.id);
  });

  test("answers 404 for a run that does not exist", async ({ request }) => {
    const res = await request.get(
      "/jobs/refresh-exchange-rates/runs/999999999",
      {
        headers: withAdminToken(),
      },
    );
    await expectStatus(res, 404);
    expect((await res.json()).error).toBe("Not found");
  });

  test("answers 404 for a run asked for under another job's name", async ({
    request,
  }) => {
    const run = await startRun(request, "refresh-exchange-rates");
    const res = await request.get(`/jobs/no-such-job/runs/${run.id}`, {
      headers: withAdminToken(),
    });
    await expectStatus(res, 404);
    expect((await res.json()).error).toBe("Not found");
    await waitForRun(request, run.job, run.id);
  });

  test("reports a completed run with its result and times", async ({
    request,
  }) => {
    // Arrange
    const run = await startRun(request, "refresh-exchange-rates");
    await waitForRun(request, run.job, run.id);

    // Act
    const res = await request.get(
      `/jobs/refresh-exchange-rates/runs/${run.id}`,
      {
        headers: withAdminToken(),
      },
    );

    // Assert
    const { data } = await expectMatchesSchema(res, JobRunResponseSchema);
    expect(data).toMatchObject({
      id: run.id,
      job: "refresh-exchange-rates",
      state: "completed",
      attempts: 1,
      error: null,
    });
    expect(data.result).toMatchObject({
      days: expect.any(Number),
      created: expect.any(Number),
    });
    expect(data.startedAt).not.toBeNull();
    expect(data.finishedAt).not.toBeNull();
  });

  test("reports a failed run with its attempts and error", async ({
    request,
  }) => {
    // Arrange: every attempt fails.
    await failStub(request);
    const run = await startRun(request, "refresh-exchange-rates");
    await waitForRun(request, run.job, run.id);

    // Act
    const res = await request.get(
      `/jobs/refresh-exchange-rates/runs/${run.id}`,
      {
        headers: withAdminToken(),
      },
    );

    // Assert
    const { data } = await expectMatchesSchema(res, JobRunResponseSchema);
    expect(data).toMatchObject({
      state: "failed",
      attempts: 3,
      result: null,
      error: "Frankfurter answered 503",
    });
  });
});
