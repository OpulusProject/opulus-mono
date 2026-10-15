import { expect, test } from "@playwright/test";
import { JobRunResponseSchema } from "@opulus/core";
import {
  expectMatchesSchema,
  expectStatus,
} from "../../../shared/assertions.js";
import { clearExchangeRates } from "../../../shared/fixtures/index.js";
import { resetStub } from "../helpers/frankfurterStub.js";
import { waitForRun, withAdminToken } from "../../../shared/scheduler.js";

/**
 * This file: POST /jobs/:name/runs, which queues a run of a job now. It is only
 * there when the scheduler has SCHEDULER_ADMIN_TOKEN, and needs that token.
 */
test.describe("POST /jobs/:name/runs", () => {
  test.beforeEach(async ({ request }) => {
    await clearExchangeRates();
    await resetStub(request);
  });

  test("requires the admin token (401)", async ({ request }) => {
    const res = await request.post("/jobs/refresh-exchange-rates/runs");
    await expectStatus(res, 401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  test("rejects a wrong admin token (401)", async ({ request }) => {
    const res = await request.post("/jobs/refresh-exchange-rates/runs", {
      headers: withAdminToken("not-the-token"),
    });
    await expectStatus(res, 401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  test("answers 404 for a job that does not exist", async ({ request }) => {
    const res = await request.post("/jobs/no-such-job/runs", {
      headers: withAdminToken(),
    });
    await expectStatus(res, 404);
    expect((await res.json()).error).toBe("Not found");
  });

  test("queues a run of the job and returns it (202), which then runs", async ({
    request,
  }) => {
    // Act
    const res = await request.post("/jobs/refresh-exchange-rates/runs", {
      headers: withAdminToken(),
    });

    // Assert: queued, not yet started.
    await expectStatus(res, 202);
    const { data: run } = await expectMatchesSchema(res, JobRunResponseSchema);
    expect(run).toMatchObject({
      job: "refresh-exchange-rates",
      attempts: 0,
      result: null,
      error: null,
      startedAt: null,
      finishedAt: null,
    });
    expect(run.id).not.toBe("");
    // The run then goes ahead on its own.
    expect((await waitForRun(request, run.job, run.id)).state).toBe(
      "completed",
    );
  });
});
