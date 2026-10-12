/**
 * Run one job now, in this process, without the queue or the scheduler.
 *
 * Local:
 *   pnpm --filter @opulus/scheduler run-job refresh-exchange-rates
 *
 * Railway (see README):
 *   railway run --service <scheduler-service> -- pnpm --filter @opulus/scheduler run-job refresh-exchange-rates
 */
import "dotenv/config";

import { logger, prisma } from "@opulus/core";
import { isJobName, jobs } from "../jobs/index.js";

const name = process.argv.slice(2).find((arg) => arg !== "--");

if (!name || !isJobName(name)) {
  logger.error(
    { given: name ?? null, jobs: Object.keys(jobs) },
    "Usage: run-job <job name>",
  );
  process.exitCode = 1;
} else {
  try {
    const result = await jobs[name].run();
    logger.info({ job: name, result }, "Job finished");
  } catch (error) {
    logger.error(
      {
        job: name,
        error_message: error instanceof Error ? error.message : String(error),
      },
      "Job failed",
    );
    process.exitCode = 1;
  }
}

await prisma.$disconnect();
