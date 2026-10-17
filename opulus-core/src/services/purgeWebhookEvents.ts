import { webhookEventRepository } from "../repositories/webhookEventRepository.js";
import { addDays, toDay } from "../utils/day.js";
import { logger } from "../utils/logger.js";

/** How long a webhook that was handled is kept: long enough to answer "did we get it?" */
export const PROCESSED_EVENT_RETENTION_DAYS = 90;

/** How long every other webhook is kept (dead, failing, or stuck): they are the ones to investigate. */
export const OTHER_EVENT_RETENTION_DAYS = 365;

export interface PurgeWebhookEventsParams {
  /** The current moment; only tests pass it. */
  now?: Date;
}

export interface PurgeWebhookEventsResult {
  /** Events received before this day, and handled, were deleted. */
  processedBefore: string;
  /** Events received before this day, in any other status, were deleted. */
  otherBefore: string;
  processedDeleted: number;
  otherDeleted: number;
}

/**
 * Delete old rows of `webhook_event` so the audit trail does not grow forever:
 * handled webhooks after 90 days, everything else after a year. Running it twice
 * is harmless.
 */
export async function purgeWebhookEvents(
  params: PurgeWebhookEventsParams = {}
): Promise<PurgeWebhookEventsResult> {
  const today = toDay(params.now ?? new Date());
  const processedBefore = addDays(today, -PROCESSED_EVENT_RETENTION_DAYS);
  const otherBefore = addDays(today, -OTHER_EVENT_RETENTION_DAYS);

  const deleted = await webhookEventRepository.deleteOlderThan({
    processedBefore: new Date(`${processedBefore}T00:00:00Z`),
    otherBefore: new Date(`${otherBefore}T00:00:00Z`),
  });

  const result = {
    processedBefore,
    otherBefore,
    processedDeleted: deleted.processed,
    otherDeleted: deleted.other,
  };
  logger.info(result, "Old webhook events deleted");
  return result;
}
