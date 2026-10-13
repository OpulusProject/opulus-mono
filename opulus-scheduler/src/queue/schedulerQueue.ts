import { logger, redisConnection } from "@opulus/core";
import { Queue, Worker } from "bullmq";
import { isJobName, jobs } from "../jobs/index.js";

const QUEUE = "scheduler";

/**
 * The scheduler's queue. Each scheduled run, and each run started through the
 * jobs API, is a job here named after the job it runs. A failed run is retried
 * twice more (2s, then 4s later) before it is marked failed.
 */
export const schedulerQueue = new Queue(QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 3600 * 24 * 7, count: 500 },
    removeOnFail: { age: 3600 * 24 * 30 },
  },
});

/**
 * Register every job's schedule with BullMQ (a job scheduler per job, in UTC),
 * and remove schedules whose job no longer exists. Safe to run on every start:
 * upserting an unchanged schedule changes nothing, and several instances
 * starting together still schedule each run once.
 */
export async function registerSchedules(): Promise<void> {
  for (const [name, job] of Object.entries(jobs)) {
    await schedulerQueue.upsertJobScheduler(
      name,
      { pattern: job.pattern, tz: "UTC" },
      { name, data: {} },
    );
    logger.info({ job: name, pattern: job.pattern }, "Job scheduled");
  }

  for (const scheduler of await schedulerQueue.getJobSchedulers()) {
    if (!isJobName(scheduler.key)) {
      await schedulerQueue.removeJobScheduler(scheduler.key);
      logger.info(
        { job: scheduler.key },
        "Removed the schedule of a job that no longer exists",
      );
    }
  }
}

/** Queue one run of each job that asks to run when the scheduler starts. */
export async function runJobsOnStart(): Promise<void> {
  for (const [name, job] of Object.entries(jobs)) {
    if (job.runOnStart) {
      await schedulerQueue.add(name, {});
      logger.info({ job: name }, "Job queued to run on start");
    }
  }
}

/**
 * The worker that runs the jobs, one at a time. A run that throws is retried
 * (see the queue's options); what a run returns is kept as its result.
 */
export function createSchedulerWorker(): Worker {
  return new Worker(
    QUEUE,
    async (job) => {
      if (!isJobName(job.name)) {
        throw new Error(`No job named ${job.name}`);
      }
      const startedAt = Date.now();
      logger.info(
        { job: job.name, run_id: job.id, attempt: job.attemptsMade + 1 },
        "Job started",
      );
      try {
        const result = await jobs[job.name].run();
        logger.info(
          {
            job: job.name,
            run_id: job.id,
            duration_ms: Date.now() - startedAt,
          },
          "Job completed",
        );
        return result;
      } catch (error) {
        logger.error(
          {
            job: job.name,
            run_id: job.id,
            attempt: job.attemptsMade + 1,
            will_retry: job.attemptsMade + 1 < (job.opts.attempts ?? 1),
            error_message:
              error instanceof Error ? error.message : String(error),
            duration_ms: Date.now() - startedAt,
          },
          "Job failed",
        );
        throw error;
      }
    },
    { connection: redisConnection, concurrency: 1 },
  );
}

/** Stop taking work and close the connections, for a graceful shutdown. */
export async function shutdownScheduler(worker: Worker): Promise<void> {
  await worker.close();
  await schedulerQueue.close();
}
