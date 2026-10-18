import { expect, test } from "@playwright/test";
import { uniqueId } from "../../../shared/client.js";
import { readWebhookEvents } from "../../../shared/fixtures/index.js";
import { deliverWebhook } from "../helpers/fixtures/index.js";

const dataWebhooks = [
  { webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE" },
  { webhook_type: "TRANSACTIONS", webhook_code: "RECURRING_TRANSACTIONS_UPDATE" },
  { webhook_type: "HOLDINGS", webhook_code: "DEFAULT_UPDATE" },
  { webhook_type: "INVESTMENTS_TRANSACTIONS", webhook_code: "DEFAULT_UPDATE" },
  { webhook_type: "INVESTMENTS_TRANSACTIONS", webhook_code: "HISTORICAL_UPDATE" },
  { webhook_type: "LIABILITIES", webhook_code: "DEFAULT_UPDATE" },
];

/**
 * This file: a data webhook for an item we no longer have. The user may have
 * disconnected the item before Plaid's webhook arrived; retrying would never
 * find it, so the worker drops it (as it does for ITEM webhooks, see
 * item/item-status.spec.ts) rather than retry it into a dead event.
 *
 * Test cases:
 * - ignores a TRANSACTIONS, RECURRING_TRANSACTIONS_UPDATE, HOLDINGS, INVESTMENTS_TRANSACTIONS or LIABILITIES webhook for an item that is gone, without retrying it
 */
test.describe("data webhooks for an item that is gone", () => {
  for (const { webhook_type, webhook_code } of dataWebhooks) {
    test(`ignores ${webhook_type} ${webhook_code}, without retrying it`, async ({ request }) => {
      // Arrange: no item has this id.
      const plaidItemId = uniqueId("plaid_item");

      // Act
      await deliverWebhook(request, { webhook_type, webhook_code, item_id: plaidItemId });

      // Assert: handled in one attempt, not failed and retried.
      const events = await readWebhookEvents(plaidItemId);
      expect(events).toMatchObject([{ status: "processed", attempts: 1 }]);
    });
  }
});
