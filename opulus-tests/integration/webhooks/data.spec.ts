import { expect, test } from "@playwright/test";

import { createAuthedUser } from "../../shared/fixtures/auth.js";
import { testDb } from "../../shared/db.js";
import { requireSandboxCredentials } from "../backend/helpers/plaidSandbox.js";
import {
  fireSandboxWebhook,
  linkItemWithWebhook,
  waitFor,
} from "./helpers.js";

/**
 * TRANSACTIONS and LIABILITIES webhooks, delivered by Plaid's sandbox to the
 * real receiver. The effect to wait for is the handler re-syncing from Plaid,
 * which moves a sync timestamp forward.
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
    const syncedBefore = (
      await testDb().item.findUniqueOrThrow({ where: { id: itemId } })
    ).syncedAt;

    // Act
    await fireSandboxWebhook(
      creds,
      accessToken,
      "TRANSACTIONS",
      "SYNC_UPDATES_AVAILABLE",
    );

    // Assert: syncedAt is only set after a successful transactions sync.
    const item = await waitFor(
      () => testDb().item.findUniqueOrThrow({ where: { id: itemId } }),
      (i) =>
        i.syncedAt !== null &&
        (syncedBefore === null || i.syncedAt > syncedBefore),
      "the item to be re-synced",
    );
    expect(item.syncedAt).not.toBeNull();
  });

  test("LIABILITIES DEFAULT_UPDATE makes the receiver refresh the item's liabilities", async ({
    request,
  }) => {
    // Arrange: the liabilities stored when the item was linked.
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId, accessToken } = await linkItemWithWebhook(
      request,
      cookie,
      creds,
    );
    const db = testDb();
    const before = await db.accountLiability.findMany({ where: { itemId } });
    expect(before.length).toBeGreaterThan(0);
    const latestBefore = Math.max(...before.map((l) => l.syncedAt.getTime()));

    // Act
    await fireSandboxWebhook(creds, accessToken, "LIABILITIES", "DEFAULT_UPDATE");

    // Assert: refreshed in place (newer sync time, same number of rows).
    const after = await waitFor(
      () => db.accountLiability.findMany({ where: { itemId } }),
      (rows) => Math.max(...rows.map((l) => l.syncedAt.getTime())) > latestBefore,
      "the liabilities to be refreshed",
    );
    expect(after.length).toBe(before.length);
  });
});
