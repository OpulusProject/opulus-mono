import { expect, test } from "@playwright/test";
import {
  readItemStatus,
  readWebhookEvents,
  seedItemWithAccount,
  seedUser,
  waitForWebhookEvents,
} from "../../../shared/fixtures/index.js";
import { expectStatus } from "../helpers/assertions.js";
import { postSignedWebhook } from "../helpers/fixtures/index.js";
import { uniqueId } from "../../../shared/client.js";

/** A user with one linked item, and the id Plaid knows the item by. */
async function linkedItem() {
  const user = await seedUser();
  const item = await seedItemWithAccount(user.id);
  return { itemId: item.itemId, plaidItemId: item.plaidItemId };
}

/** Send an ITEM webhook for an item, signed as Plaid signs it, and wait for the worker to finish. */
async function deliver(
  request: Parameters<typeof postSignedWebhook>[0],
  plaidItemId: string,
  event: Record<string, unknown>,
) {
  const handledBefore = (await readWebhookEvents(plaidItemId)).filter((e) => e.status === "processed").length;
  const res = await postSignedWebhook(request, {
    webhook_type: "ITEM",
    item_id: plaidItemId,
    ...event,
  });
  await expectStatus(res, 200);
  // One more handled than before, so an earlier webhook for this item does not count.
  await waitForWebhookEvents(plaidItemId, "processed", handledBefore + 1);
}

/**
 * This file: what the worker does with ITEM webhooks, which tell us that an
 * item's connection changed. Each is signed with the Plaid stub's key and sent
 * to the receiver, and what the worker recorded on the item is read from the
 * test DB (the backend that serves it is not part of this suite). Nothing here
 * calls Plaid: these webhooks carry everything the worker needs.
 */
test.describe("ITEM webhooks", () => {
  test("ERROR records the connection error so the user can be asked to reconnect", async ({ request }) => {
    // Arrange
    const { itemId, plaidItemId } = await linkedItem();

    // Act
    await deliver(request, plaidItemId, {
      webhook_code: "ERROR",
      error: {
        error_type: "ITEM_ERROR",
        error_code: "ITEM_LOGIN_REQUIRED",
        error_message: "the login details of this item have changed",
        display_message: "Sign in again",
      },
    });

    // Assert
    expect(await readItemStatus(itemId)).toMatchObject({
      errorType: "ITEM_ERROR",
      errorCode: "ITEM_LOGIN_REQUIRED",
      errorMessage: "the login details of this item have changed",
      displayMessage: "Sign in again",
    });
  });

  test("LOGIN_REPAIRED clears a recorded error", async ({ request }) => {
    // Arrange: an item with an error recorded.
    const { itemId, plaidItemId } = await linkedItem();
    await deliver(request, plaidItemId, {
      webhook_code: "ERROR",
      error: { error_type: "ITEM_ERROR", error_code: "ITEM_LOGIN_REQUIRED", error_message: "login required" },
    });

    // Act: Plaid says the item healed without the user going through update mode.
    await deliver(request, plaidItemId, { webhook_code: "LOGIN_REPAIRED" });

    // Assert
    expect(await readItemStatus(itemId)).toMatchObject({ errorType: null, errorCode: null, errorMessage: null });
  });

  test("NEW_ACCOUNTS_AVAILABLE flags the item so the user can add the accounts", async ({ request }) => {
    // Arrange
    const { itemId, plaidItemId } = await linkedItem();
    expect((await readItemStatus(itemId)).newAccountsAvailable).toBe(false);

    // Act
    await deliver(request, plaidItemId, { webhook_code: "NEW_ACCOUNTS_AVAILABLE" });

    // Assert
    expect((await readItemStatus(itemId)).newAccountsAvailable).toBe(true);
  });

  test("PENDING_DISCONNECT warns when and why Plaid will disconnect the item", async ({ request }) => {
    // Arrange
    const { itemId, plaidItemId } = await linkedItem();

    // Act
    await deliver(request, plaidItemId, {
      webhook_code: "PENDING_DISCONNECT",
      disconnect_time: "2026-11-30T00:00:00Z",
      reason: "INSTITUTION_MIGRATION",
    });

    // Assert
    const item = await readItemStatus(itemId);
    expect(item).toMatchObject({ errorType: "ITEM_ERROR", errorCode: "PENDING_DISCONNECT" });
    expect(item.errorMessage).toContain("2026-11-30");
    expect(item.errorMessage).toContain("INSTITUTION_MIGRATION");
  });

  test("PENDING_EXPIRATION warns and records when consent expires", async ({ request }) => {
    // Arrange
    const { itemId, plaidItemId } = await linkedItem();

    // Act
    await deliver(request, plaidItemId, {
      webhook_code: "PENDING_EXPIRATION",
      consent_expiration_time: "2026-12-15T00:00:00Z",
    });

    // Assert
    const item = await readItemStatus(itemId);
    expect(item).toMatchObject({ errorCode: "PENDING_EXPIRATION" });
    expect(item.consentExpirationTime?.toISOString()).toBe("2026-12-15T00:00:00.000Z");
  });

  test("USER_PERMISSION_REVOKED is recorded and the item is kept for the user to re-grant access", async ({ request }) => {
    // Arrange
    const { itemId, plaidItemId } = await linkedItem();

    // Act
    await deliver(request, plaidItemId, {
      webhook_code: "USER_PERMISSION_REVOKED",
      error: { error_type: "ITEM_ERROR", error_code: "USER_PERMISSION_REVOKED", error_message: "the user revoked access" },
    });

    // Assert
    expect(await readItemStatus(itemId)).toMatchObject({ id: itemId, errorCode: "USER_PERMISSION_REVOKED" });
  });

  test("ignores a webhook for an item we no longer have, without retrying it", async ({ request }) => {
    // Arrange: the user disconnected the item before the webhook arrived.
    const unknownItem = uniqueId("plaid_item");

    // Act
    await deliver(request, unknownItem, { webhook_code: "NEW_ACCOUNTS_AVAILABLE" });

    // Assert: handled in one attempt, not failed and retried.
    const [event] = await readWebhookEvents(unknownItem);
    expect(event).toMatchObject({ status: "processed", attempts: 1 });
  });

  test("handles an ITEM webhook code it has no action for (processed, nothing recorded)", async ({ request }) => {
    // Arrange
    const { itemId, plaidItemId } = await linkedItem();

    // Act
    await deliver(request, plaidItemId, { webhook_code: "WEBHOOK_UPDATE_ACKNOWLEDGED" });

    // Assert
    expect(await readItemStatus(itemId)).toMatchObject({ errorCode: null, newAccountsAvailable: false });
  });
});
