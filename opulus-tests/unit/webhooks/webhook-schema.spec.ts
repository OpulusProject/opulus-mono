import { expect, test } from "@playwright/test";
import { PlaidWebhookEventSchema } from "../../../opulus-webhooks/src/types/plaid/webhookSchema.js";

/**
 * The shape the receiver accepts a Plaid webhook in
 * (opulus-webhooks/src/types/plaid/webhookSchema.ts).
 *
 * Test cases:
 * - accepts the smallest event: a type and a code
 * - accepts Plaid's optional fields with the types Plaid sends them in
 * - accepts an error that is null, and one with a null display message
 * - keeps fields it does not know, so a new Plaid field is not dropped
 * - rejects an event without a type or a code, or with the wrong type for a known field
 */
const minimal = { webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE" };

test.describe("webhook payload schema", () => {
  test("accepts the smallest event: a type and a code", () => {
    expect(PlaidWebhookEventSchema.parse(minimal)).toEqual(minimal);
  });

  test("accepts Plaid's optional fields with the types Plaid sends them in", () => {
    const full = {
      ...minimal,
      item_id: "item-1",
      environment: "sandbox",
      new_transactions: 3,
      removed_transactions: ["a", "b"],
      new_holdings: 1,
      updated_holdings: 2,
      account_ids: ["acc-1"],
      account_ids_with_new_liabilities: ["acc-1"],
      account_ids_with_updated_liabilities: { "acc-2": ["minimum_payment_amount", "apr"] },
      consent_expiration_time: "2026-12-01T00:00:00Z",
      disconnect_time: "2026-11-01T00:00:00Z",
      reason: "FI_ISSUE",
    };

    expect(PlaidWebhookEventSchema.parse(full)).toEqual(full);
  });

  test("accepts an error that is null, and one with a null display message", () => {
    expect(PlaidWebhookEventSchema.safeParse({ ...minimal, error: null }).success).toBe(true);
    expect(
      PlaidWebhookEventSchema.safeParse({
        ...minimal,
        error: { error_type: "ITEM_ERROR", error_code: "ITEM_LOGIN_REQUIRED", error_message: "x", display_message: null },
      }).success,
    ).toBe(true);
  });

  test("keeps fields it does not know, so a new Plaid field is not dropped", () => {
    const withNew = { ...minimal, something_plaid_added: { nested: [1, 2] } };

    expect(PlaidWebhookEventSchema.parse(withNew)).toEqual(withNew);
  });

  test("rejects an event without a type or a code, or with the wrong type for a known field", () => {
    expect(PlaidWebhookEventSchema.safeParse({ webhook_code: "X" }).success).toBe(false);
    expect(PlaidWebhookEventSchema.safeParse({ webhook_type: "X" }).success).toBe(false);
    expect(PlaidWebhookEventSchema.safeParse({ ...minimal, new_transactions: "3" }).success).toBe(false);
    expect(PlaidWebhookEventSchema.safeParse({ ...minimal, account_ids: "acc-1" }).success).toBe(false);
    expect(PlaidWebhookEventSchema.safeParse({ ...minimal, error: { error_type: "X" } }).success).toBe(false);
    expect(PlaidWebhookEventSchema.safeParse({ ...minimal, account_ids_with_updated_liabilities: { a: "apr" } }).success).toBe(false);
    expect(PlaidWebhookEventSchema.safeParse("not an object").success).toBe(false);
  });
});
