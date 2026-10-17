import { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../client/prisma.js";
import { AppError, NotFoundError } from "../utils/errors.js";

/** The queue job an event is being handled by. */
export interface WebhookEventJob {
  jobId: string;
  /** When the job was queued. */
  receivedAt: Date;
}

export interface WebhookEventStart extends WebhookEventJob {
  webhookType: string;
  webhookCode: string;
  /** Plaid's item id, when the event has one. */
  plaidItemId?: string;
  /** The whole webhook event. */
  payload: object;
  /** Which attempt this is, counting from 1. */
  attempt: number;
}

/**
 * Repository for webhook events
 * The audit trail of the webhooks the worker handled, and the ones it gave up
 * on, which can be replayed
 */
class WebhookEventRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Note that a job is being worked on: creates the event on its first
   * attempt, and on a retry puts it back to processing.
   * @throws AppError if database error occurs
   */
  async start(data: WebhookEventStart) {
    const { jobId, receivedAt, attempt, payload, ...fields } = data;
    try {
      await this.prisma.webhookEvent.upsert({
        where: { jobId_receivedAt: { jobId, receivedAt } },
        create: {
          ...fields,
          jobId,
          receivedAt,
          payload: payload as Prisma.InputJsonValue,
          status: "processing",
          attempts: attempt,
        },
        update: { status: "processing", attempts: attempt },
      });
    } catch (error) {
      throw toAppError(error, "record a webhook event");
    }
  }

  /**
   * Note that a job was handled.
   * @throws AppError if database error occurs
   */
  async markProcessed(job: WebhookEventJob) {
    try {
      await this.prisma.webhookEvent.updateMany({
        where: { jobId: job.jobId, receivedAt: job.receivedAt },
        data: { status: "processed", error: null, processedAt: new Date() },
      });
    } catch (error) {
      throw toAppError(error, "record a handled webhook event");
    }
  }

  /**
   * Note that an attempt failed: "retrying" if the job will run again, "dead"
   * if it will not.
   * @throws AppError if database error occurs
   */
  async markFailed(
    job: WebhookEventJob,
    failure: { error: string; attempts: number; final: boolean }
  ) {
    try {
      await this.prisma.webhookEvent.updateMany({
        where: { jobId: job.jobId, receivedAt: job.receivedAt },
        data: {
          status: failure.final ? "dead" : "retrying",
          error: failure.error,
          attempts: failure.attempts,
          processedAt: failure.final ? new Date() : null,
        },
      });
    } catch (error) {
      throw toAppError(error, "record a failed webhook event");
    }
  }

  /**
   * Delete old events: handled ones received before `processedBefore`, and
   * every other one (retrying, dead, stuck in processing) received before
   * `otherBefore`.
   * @returns How many of each were deleted
   * @throws AppError if database error occurs
   */
  async deleteOlderThan(cutoffs: { processedBefore: Date; otherBefore: Date }) {
    try {
      const [processed, other] = await this.prisma.$transaction([
        this.prisma.webhookEvent.deleteMany({
          where: { status: "processed", receivedAt: { lt: cutoffs.processedBefore } },
        }),
        this.prisma.webhookEvent.deleteMany({
          where: { status: { not: "processed" }, receivedAt: { lt: cutoffs.otherBefore } },
        }),
      ]);
      return { processed: processed.count, other: other.count };
    } catch (error) {
      throw toAppError(error, "delete old webhook events");
    }
  }

  /**
   * Take a dead event to replay it: marks it replayed and returns it, or throws
   * if it is not dead or was already replayed, so two operators cannot replay
   * one event twice.
   * @param id - The event id
   * @throws NotFoundError if there is no such event
   * @throws AppError (409) if it is not dead or was already replayed; on a database error
   */
  async claimForReplay(id: string) {
    try {
      const claimed = await this.prisma.webhookEvent.updateMany({
        where: { id, status: "dead", replayedAt: null },
        data: { replayedAt: new Date() },
      });
      const event = await this.prisma.webhookEvent.findUnique({ where: { id } });
      if (!event) {
        throw new NotFoundError(`No webhook event with id ${id}`);
      }
      if (claimed.count === 0) {
        throw new AppError(
          event.replayedAt
            ? `Webhook event ${id} was already replayed at ${event.replayedAt.toISOString()}`
            : `Webhook event ${id} is not dead (it is ${event.status}), so it is not replayed`,
          409
        );
      }
      return event;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw toAppError(error, "replay a webhook event");
    }
  }

  /**
   * Give an event back, undoing `claimForReplay`: used when putting it back on
   * the queue failed, so it can be replayed again.
   * @throws AppError if database error occurs
   */
  async releaseReplay(id: string): Promise<void> {
    try {
      await this.prisma.webhookEvent.update({
        where: { id },
        data: { replayedAt: null },
      });
    } catch (error) {
      throw toAppError(error, "release a webhook event");
    }
  }
}

function toAppError(error: unknown, action: string): AppError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return new AppError(`Database error: ${error.message}`, 500, error.code);
  }
  const message =
    error instanceof Error
      ? `Failed to ${action}: ${error.message}`
      : `An unexpected error occurred while trying to ${action}`;
  return new AppError(message, 500);
}

// Export singleton instance
export const webhookEventRepository = new WebhookEventRepository(prisma);
