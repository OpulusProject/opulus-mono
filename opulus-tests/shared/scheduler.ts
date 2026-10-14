import { expect, type APIRequestContext } from "@playwright/test";
import { JobRunResponseSchema, type JobRunDTO } from "@opulus/core";
import { expectMatchesSchema, expectStatus } from "./assertions.js";

/**
 * Talking to the scheduler's jobs API. Every request needs the admin token the
 * scheduler was started with (SCHEDULER_ADMIN_TOKEN).
 */

export function adminToken(): string {
  const token = process.env.SCHEDULER_ADMIN_TOKEN;
  if (!token) {
    throw new Error(
      "SCHEDULER_ADMIN_TOKEN is not set: set it to the token the scheduler under test was started with.",
    );
  }
  return token;
}

export const withAdminToken = (token = adminToken()) => ({
  authorization: `Bearer ${token}`,
});

/** Queue a run of `job` now; returns the run (202). */
export async function startRun(
  request: APIRequestContext,
  job: string,
): Promise<JobRunDTO> {
  const res = await request.post(`/jobs/${job}/runs`, {
    headers: withAdminToken(),
  });
  await expectStatus(res, 202);
  return (await expectMatchesSchema(res, JobRunResponseSchema)).data;
}

/** A run as the scheduler reports it now. */
export async function getRun(
  request: APIRequestContext,
  job: string,
  id: string,
): Promise<JobRunDTO> {
  const res = await request.get(`/jobs/${job}/runs/${id}`, {
    headers: withAdminToken(),
  });
  return (await expectMatchesSchema(res, JobRunResponseSchema)).data;
}

/**
 * Follow a run until it has completed or failed for good. A failed attempt that
 * will be retried is `delayed`, so that keeps waiting. Retries back off 2s then
 * 4s, so a run that fails every attempt takes about 6s.
 */
export async function waitForRun(
  request: APIRequestContext,
  job: string,
  id: string,
  timeoutMs = 30_000,
): Promise<JobRunDTO> {
  let run = await getRun(request, job, id);
  await expect
    .poll(
      async () => {
        run = await getRun(request, job, id);
        return run.state;
      },
      { timeout: timeoutMs, intervals: [200, 500, 1000] },
    )
    .toMatch(/^(completed|failed)$/);
  return run;
}

/** Start a run of `job` and wait for it to finish. */
export async function runToEnd(
  request: APIRequestContext,
  job: string,
  timeoutMs?: number,
): Promise<JobRunDTO> {
  const run = await startRun(request, job);
  return waitForRun(request, job, run.id, timeoutMs);
}
