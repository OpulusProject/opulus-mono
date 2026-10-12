import { createHash, timingSafeEqual } from "node:crypto";
import {
  NotFoundError,
  UnauthorizedError,
  type JobRunDTO,
  type JobRunResponse,
} from "@opulus/core";
import type { Job } from "bullmq";
import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from "express";
import { isJobName } from "../jobs/index.js";
import { schedulerQueue } from "../queue/schedulerQueue.js";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Requests must carry `Authorization: Bearer <SCHEDULER_ADMIN_TOKEN>`. */
function requireAdminToken(adminToken: string) {
  const expected = digest(adminToken);
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    // Compare digests so the comparison takes the same time whatever the input.
    if (!token || !timingSafeEqual(digest(token), expected)) {
      throw new UnauthorizedError("A valid admin token is required");
    }
    next();
  };
}

const iso = (ms: number | undefined) =>
  ms ? new Date(ms).toISOString() : null;

async function toJobRunDTO(job: Job): Promise<JobRunDTO> {
  return {
    id: job.id ?? "",
    job: job.name,
    state: await job.getState(),
    attempts: job.attemptsMade,
    result: job.returnvalue ?? null,
    error: job.failedReason || null,
    queuedAt: new Date(job.timestamp).toISOString(),
    startedAt: iso(job.processedOn),
    finishedAt: iso(job.finishedOn),
  };
}

/**
 * The jobs API: run a job now and follow the run. Only mounted when
 * SCHEDULER_ADMIN_TOKEN is set, and every request needs that token.
 *
 * - POST /jobs/:name/runs     queue a run now (202, the run)
 * - GET  /jobs/:name/runs/:id the run's state, result or error
 */
export function jobsRouter(adminToken: string): Router {
  const router = Router();
  router.use(requireAdminToken(adminToken));

  router.post(
    "/:name/runs",
    async (req: Request<{ name: string }>, res: Response<JobRunResponse>) => {
      const { name } = req.params;
      if (!isJobName(name)) {
        throw new NotFoundError(`No job named ${name}`);
      }
      const job = await schedulerQueue.add(name, {});
      res.status(202).json({ data: await toJobRunDTO(job) });
    },
  );

  router.get(
    "/:name/runs/:id",
    async (
      req: Request<{ name: string; id: string }>,
      res: Response<JobRunResponse>,
    ) => {
      const { name, id } = req.params;
      const job = isJobName(name) ? await schedulerQueue.getJob(id) : undefined;
      if (!job || job.name !== name) {
        throw new NotFoundError(`No run ${id} of ${name}`);
      }
      res.status(200).json({ data: await toJobRunDTO(job) });
    },
  );

  return router;
}
