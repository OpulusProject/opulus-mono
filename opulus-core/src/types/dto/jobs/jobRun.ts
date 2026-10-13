/**
 * Job run DTOs, for opulus-scheduler's jobs API (`POST /jobs/:name/runs`,
 * `GET /jobs/:name/runs/:id`). Not a public API: it is behind an admin token
 * and lets an operator, or the jobs test suite, run a job now and follow it.
 */

import { z } from "zod";

/** Where a run is: BullMQ's job states. */
export const JobRunStateSchema = z.enum([
  "waiting",
  "prioritized",
  "delayed",
  "active",
  "waiting-children",
  "completed",
  "failed",
  "unknown",
]);

export type JobRunState = z.infer<typeof JobRunStateSchema>;

export const JobRunDTOSchema = z.object({
  id: z.string(),
  /** The job's name, e.g. "refresh-exchange-rates". */
  job: z.string(),
  state: JobRunStateSchema,
  /** Attempts made so far (a failed attempt is retried, up to three in all). */
  attempts: z.number().int(),
  /** What the job returned, once it has completed; otherwise null. */
  result: z.unknown().nullable(),
  /** Why the last attempt failed, if one did; otherwise null. */
  error: z.string().nullable(),
  /** ISO timestamps. */
  queuedAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});

export type JobRunDTO = z.infer<typeof JobRunDTOSchema>;

export const JobRunResponseSchema = z.object({
  data: JobRunDTOSchema,
});

export type JobRunResponse = z.infer<typeof JobRunResponseSchema>;
