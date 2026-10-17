import { expect, test } from "@playwright/test";

import { withSession } from "../../shared/client.js";
import { createAuthedUser } from "../../shared/fixtures/auth.js";
import { requireSandboxCredentials } from "../helpers/plaidSandbox.js";
import {
  fireSandboxWebhook,
  linkItemWithWebhook,
  readItem,
  waitFor,
} from "./helpers.js";

/**
 * A TRANSACTIONS webhook, delivered by Plaid's sandbox to the real receiver: the
 * one thing the stubbed suite cannot prove. The effect to wait for is the
 * handler re-syncing from Plaid, which moves the sync timestamp forward, read
 * the way the client reads it, from GET /api/items. What each webhook does with
 * Plaid's data is covered in services/webhooks/data.
 */
test.describe("data webhooks (sandbox to receiver)", () => {
  test("TRANSACTIONS SYNC_UPDATES_AVAILABLE makes the receiver sync the item", async ({
    request,
  }) => {
    // Arrange
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId, accessToken } = await linkItemWithWebhook(
      request,
      cookie,
      creds,
    );
    const syncedBefore = (await readItem(request, cookie, itemId)).syncedAt;

    // Act
    await fireSandboxWebhook(
      creds,
      accessToken,
      "TRANSACTIONS",
      "SYNC_UPDATES_AVAILABLE",
    );

    // Assert: syncedAt is only set after a successful transactions sync.
    const item = await waitFor(
      () => readItem(request, cookie, itemId),
      (i) =>
        i.syncedAt !== null &&
        (syncedBefore === null ||
          new Date(i.syncedAt).getTime() > new Date(syncedBefore).getTime()),
      "the item to be re-synced",
    );
    expect(item.syncedAt).not.toBeNull();

    // Assert: what Plaid sent was stored in the shape the API documents, read
    // the way the client reads it. Only the category is asserted: whether a
    // transaction has a logo or location depends on which merchants the
    // sandbox returns. A new sandbox item has no transactions for
    // its first few seconds, so keep asking Plaid to sync until some arrive.
    type Listed = Array<{
      category: { primary: string; detailed: string | null } | null;
    }>;
    let reads = 0;
    const transactions = await waitFor(
      async () => {
        if (++reads % 8 === 0) {
          await fireSandboxWebhook(
            creds,
            accessToken,
            "TRANSACTIONS",
            "SYNC_UPDATES_AVAILABLE",
          );
        }
        const res = await request.get(
          `/api/transactions?itemId=${itemId}&limit=200`,
          { headers: withSession(cookie) },
        );
        return (await res.json()).data.transactions as Listed;
      },
      (list) => list.length > 0,
      "the sandbox transactions to be synced",
    );
    expect(transactions.some((t) => t.category?.primary)).toBe(true);
  });
});
