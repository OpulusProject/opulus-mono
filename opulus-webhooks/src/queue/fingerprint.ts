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
  return createHash("sha256").update(JSON.stringify(sortKeys(event))).digest("hex");
}

/**
 * The value with its object keys in order at every depth, so equal events
 * stringify equally. (`JSON.stringify`'s key-list argument is not enough: it
 * also applies to nested objects, and drops every nested key that is not a
 * top-level one, so events that differ only inside `error` looked identical.)
 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, nested]) => [key, sortKeys(nested)])
    );
  }
  return value;
}
