import { expect, test } from "@playwright/test";

import { createAuthedUser } from "../../shared/fixtures/auth.js";
import { requireSandboxCredentials } from "../helpers/plaidSandbox.js";
import {
  fireSandboxWebhook,
  linkItemWithWebhook,
  readItem,
  waitFor,
} from "./helpers.js";

/**
 * TRANSACTIONS and LIABILITIES webhooks, delivered by Plaid's sandbox to the
 * real receiver. The effect to wait for is the handler re-syncing from Plaid,
 * which moves a sync timestamp forward. Both timestamps are read the way the
 * client reads them, from GET /api/items.
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
    const liabilitySyncTimes = async () =>
      (await readItem(request, cookie, itemId)).accounts.flatMap((a) =>
        a.liabilityDetails ? [new Date(a.liabilityDetails.syncedAt).getTime()] : [],
      );
    const before = await liabilitySyncTimes();
    expect(before.length).toBeGreaterThan(0);
    const latestBefore = Math.max(...before);

    // Act
    await fireSandboxWebhook(creds, accessToken, "LIABILITIES", "DEFAULT_UPDATE");

    // Assert: refreshed in place (newer sync time, same number of liabilities).
    const after = await waitFor(
      liabilitySyncTimes,
      (times) => Math.max(...times) > latestBefore,
      "the liabilities to be refreshed",
    );
    expect(after.length).toBe(before.length);
  });
});
