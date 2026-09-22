import { createHash } from "node:crypto";

import type { PlaidWebhookEvent } from "../types/plaid/webhookSchema.js";

/**
 * Deterministic fingerprint of a delivered webhook event.
 *
 * Used with BullMQ's short-TTL deduplication to collapse Plaid's rapid
 * re-deliveries of the *same* event (e.g. when Plaid doesn't receive our ACK
 * in time and retries within seconds). Keys are sorted so the hash is stable
 * regardless of property order.
 *
 * Note: this intentionally hashes the full body rather than a static key like
 * `type:code:item_id`. Events such as TRANSACTIONS/SYNC_UPDATES_AVAILABLE fire
 * legitimately many times for the same item, so we only want to dedupe true
 * duplicate deliveries (identical payloads) inside a small time window.
 */
export function webhookFingerprint(event: PlaidWebhookEvent): string {
  const stable = JSON.stringify(event, Object.keys(event).sort());
  return createHash("sha256").update(stable).digest("hex");
}
