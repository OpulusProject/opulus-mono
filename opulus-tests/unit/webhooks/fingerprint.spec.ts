import { expect, test } from "@playwright/test";
import { webhookFingerprint } from "../../../opulus-webhooks/src/queue/fingerprint.js";

const event = {
  webhook_type: "ITEM",
  webhook_code: "ERROR",
  item_id: "item-1",
  error: { error_type: "ITEM_ERROR", error_code: "ITEM_LOGIN_REQUIRED", error_message: "login required" },
};

/**
 * The fingerprint the receiver deduplicates by (opulus-webhooks/src/queue/fingerprint.ts):
 * two deliveries with the same fingerprint inside a minute are one job. Too
 * coarse a fingerprint drops real events; too fine a one lets Plaid's repeats
 * through.
 *
 * Test cases:
 * - is a SHA-256 hex digest
 * - is the same for the same event, however its keys are ordered
 * - differs when a top-level field differs
 * - differs when only a field inside a nested object differs
 * - differs when a nested key is added, or a list changes
 */
test.describe("webhook fingerprint", () => {
  test("is a SHA-256 hex digest", () => {
    expect(webhookFingerprint(event)).toMatch(/^[0-9a-f]{64}$/);
  });

  test("is the same for the same event, however its keys are ordered", () => {
    const shuffled = {
      item_id: "item-1",
      error: { error_message: "login required", error_code: "ITEM_LOGIN_REQUIRED", error_type: "ITEM_ERROR" },
      webhook_code: "ERROR",
      webhook_type: "ITEM",
    };

    expect(webhookFingerprint(shuffled)).toBe(webhookFingerprint(event));
  });

  test("differs when a top-level field differs", () => {
    expect(webhookFingerprint({ ...event, item_id: "item-2" })).not.toBe(webhookFingerprint(event));
    expect(webhookFingerprint({ ...event, webhook_code: "LOGIN_REPAIRED" })).not.toBe(webhookFingerprint(event));
  });

  test("differs when only a field inside a nested object differs", () => {
    // Two different errors for one item are two events, not a repeat delivery.
    const other = { ...event, error: { ...event.error, error_code: "ITEM_NOT_FOUND" } };

    expect(webhookFingerprint(other)).not.toBe(webhookFingerprint(event));
  });

  test("differs when a nested key is added, or a list changes", () => {
    const liabilities = { webhook_type: "LIABILITIES", webhook_code: "DEFAULT_UPDATE", item_id: "item-1" };
    const one = { ...liabilities, account_ids_with_updated_liabilities: { acc1: ["minimum_payment_amount"] } };
    const two = { ...liabilities, account_ids_with_updated_liabilities: { acc1: ["minimum_payment_amount"], acc2: ["apr"] } };
    const listed = { ...liabilities, account_ids: ["acc1"] };
    const listedMore = { ...liabilities, account_ids: ["acc1", "acc2"] };

    expect(new Set([one, two, liabilities].map(webhookFingerprint)).size).toBe(3);
    expect(webhookFingerprint(listed)).not.toBe(webhookFingerprint(listedMore));
  });
});
