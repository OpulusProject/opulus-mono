import { Queue } from "bullmq";
import { expect, test } from "@playwright/test";
import { exited, startService, type RunningService } from "../helpers/service.js";

const PORT = 18297;
const JOB = "refresh-exchange-rates";
const PRICES = "refresh-security-prices";
const BACKFILL = "backfill-security-prices";
const JOBS = [BACKFILL, JOB, PRICES];
const RETIRED = "a-job-that-was-removed";

/** Stop it the way a deploy does, so that nothing is left holding the port (a kill would leave tsx's child running). */
async function stop(service: RunningService) {
  service.child.kill("SIGTERM");
  await exited(service.child);
}

/** The scheduler's queue, from the test side, on the Redis the scheduler under test uses. */
const queue = new Queue("scheduler", {
  connection: { host: process.env.REDIS_HOST ?? "localhost", port: Number(process.env.REDIS_PORT ?? 6379) },
});

/**
 * This file: the schedules the scheduler registers when it starts. A job is a
 * name, a schedule (a cron pattern, or every so many minutes) and a call to a
 * service (jobs/index.ts); at start-up the
 * scheduler makes the queue's schedules match, adding or updating each job's and
 * removing those of jobs that no longer exist. It starts a scheduler of its own
 * (with no start-up run) and reads the schedules from its Redis.
 *
 * Test cases:
 * - registers each job's schedule, in UTC, with the pattern it asks for
 * - schedules the security prices job every SECURITY_PRICES_INTERVAL_MINUTES, and every 15 minutes when it is not a whole number from 1 to 1440
 * - removes the schedule of a job that no longer exists, and keeps the others
 * - registers the same schedule again when started again (no duplicate)
 * - queues the jobs that ask to run at start-up, unless told not to
 * - fails a run of a job it does not have, saying so
 */
test.describe("scheduler schedules", () => {
  let scheduler: RunningService | undefined;

  const start = async (cron = "5 4 * * *", env: Record<string, string> = {}) => {
    scheduler = await startService({
      workspace: "opulus-scheduler",
      port: PORT,
      portVariable: "SCHEDULER_PORT",
      env: { SCHEDULER_RUN_ON_START: "false", EXCHANGE_RATES_CRON: cron, ...env },
    });
  };

  test.afterEach(async () => {
    if (scheduler) await stop(scheduler);
    scheduler = undefined;
    for (const { key } of await queue.getJobSchedulers()) await queue.removeJobScheduler(key);
  });

  test.afterAll(async () => {
    await queue.close();
  });

  test("registers each job's schedule, in UTC, with the pattern it asks for", async () => {
    // Act
    await start("5 4 * * *");

    // Assert
    const registered = await queue.getJobSchedulers();
    expect(registered.map((s) => s.key).sort()).toEqual(JOBS);
    expect(registered.find((s) => s.key === JOB)).toMatchObject({ name: JOB, pattern: "5 4 * * *", tz: "UTC" });
    expect(registered.find((s) => s.key === BACKFILL)).toMatchObject({ every: 5 * 60 * 1000 });
  });

  test("schedules the security prices job every SECURITY_PRICES_INTERVAL_MINUTES, and every 15 minutes when it is not a whole number from 1 to 1440", async () => {
    // Act and assert: configured, then each kind of bad value.
    const every = async (minutes?: string) => {
      await start("5 4 * * *", minutes === undefined ? {} : { SECURITY_PRICES_INTERVAL_MINUTES: minutes });
      const found = (await queue.getJobSchedulers()).find((s) => s.key === PRICES);
      await stop(scheduler!);
      scheduler = undefined;
      return found?.every;
    };
    expect(await every("1")).toBe(60 * 1000);
    expect(await every("7")).toBe(7 * 60 * 1000);
    expect(await every()).toBe(15 * 60 * 1000);
    expect(await every("0")).toBe(15 * 60 * 1000);
    expect(await every("1441")).toBe(15 * 60 * 1000);
    expect(await every("soon")).toBe(15 * 60 * 1000);
  });

  test("removes the schedule of a job that no longer exists, and keeps the others", async () => {
    // Arrange: a schedule left over from a job that has since been removed.
    await queue.upsertJobScheduler(RETIRED, { pattern: "0 1 * * *", tz: "UTC" }, { name: RETIRED, data: {} });
    expect((await queue.getJobSchedulers()).map((s) => s.key)).toContain(RETIRED);

    // Act
    await start();

    // Assert
    expect((await queue.getJobSchedulers()).map((s) => s.key).sort()).toEqual(JOBS);
  });

  test("registers the same schedule again when started again (no duplicate)", async () => {
    // Arrange: started, stopped, and started with another pattern.
    await start("5 4 * * *");
    await stop(scheduler!);

    // Act
    await start("30 6 * * *");

    // Assert: still one schedule for each job, with the new pattern.
    const registered = await queue.getJobSchedulers();
    expect(registered).toHaveLength(JOBS.length);
    expect(registered.find((s) => s.key === JOB)).toMatchObject({ pattern: "30 6 * * *" });
  });

  test("queues the jobs that ask to run at start-up, unless told not to", async () => {
    // Act: started the way a deploy starts it, with the provider unreachable so the run itself goes nowhere.
    await start("5 4 * * *", { SCHEDULER_RUN_ON_START: "true", FRANKFURTER_BASE_URL: "http://localhost:1/v1", YAHOO_FINANCE_BASE_URL: "http://localhost:1" });

    // Assert
    expect(scheduler!.output()).toContain("Job queued to run on start");
    await queue.obliterate({ force: true });
  });

  test("fails a run of a job it does not have, saying so", async () => {
    // Arrange
    await start();

    // Act: a run of a name that is not a job (say, one removed after it was queued).
    const job = await queue.add("a-job-that-was-removed", {}, { attempts: 1 });
    let failed = "";
    for (let i = 0; i < 100 && !failed; i++) {
      failed = (await queue.getJob(job.id!))?.failedReason ?? "";
      if (!failed) await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Assert
    expect(failed).toBe("No job named a-job-that-was-removed");
    await queue.obliterate({ force: true });
  });
});
