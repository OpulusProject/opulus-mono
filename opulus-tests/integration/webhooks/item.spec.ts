import { expect, test } from "@playwright/test";

import { createAuthedUser } from "../../shared/fixtures/auth.js";
import { requireSandboxCredentials } from "../backend/helpers/plaidSandbox.js";
import {
  fireNewAccountsAvailableOrSkip,
  fireSandboxWebhook,
  linkItemWithWebhook,
  readItem,
  resetSandboxLogin,
  waitFor,
} from "./helpers.js";

/**
 * ITEM webhooks, delivered by Plaid's sandbox to the real receiver.
 *
 * Each test links a fresh sandbox item whose webhook URL is the receiver, asks
 * Plaid to fire one webhook, and waits for its effect to appear on the item as
 * the client reads it from GET /api/items.
 */
test.describe("ITEM webhooks (sandbox to receiver)", () => {
  test("NEW_ACCOUNTS_AVAILABLE flags the item so the user can add the accounts", async ({
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
    expect((await readItem(request, cookie, itemId)).newAccountsAvailable).toBe(
      false,
    );

    // Act
    await fireNewAccountsAvailableOrSkip(test, creds, accessToken);

    // Assert
    await waitFor(
      () => readItem(request, cookie, itemId),
      (item) => item.newAccountsAvailable,
      "the item to be flagged with new accounts",
    );
  });

  test("an item sent into ITEM_LOGIN_REQUIRED is recorded as needing a reconnect", async ({
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

    // Act: Plaid sends an ITEM ERROR webhook for the reset.
    await resetSandboxLogin(creds, accessToken);

    // Assert
    const item = await waitFor(
      () => readItem(request, cookie, itemId),
      (i) => i.errorCode !== null,
      "the login-required error to be recorded",
    );
    expect(item.errorCode).toBe("ITEM_LOGIN_REQUIRED");
    expect(item.errorType).toBe("ITEM_ERROR");
  });

  test("LOGIN_REPAIRED clears a recorded warning", async ({ request }) => {
    // Arrange: a webhook makes the receiver record a warning first. (Plaid
    // won't fire LOGIN_REPAIRED at an item that is really in login-required
    // state, so the item stays healthy and the warning is the thing to clear.)
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId, accessToken } = await linkItemWithWebhook(
      request,
      cookie,
      creds,
    );
    await fireSandboxWebhook(creds, accessToken, "ITEM", "PENDING_DISCONNECT");
    await waitFor(
      () => readItem(request, cookie, itemId),
      (item) => item.errorCode !== null,
      "the warning to be recorded",
    );

    // Act: Plaid reports the item healed without the user going through update mode.
    await fireSandboxWebhook(creds, accessToken, "ITEM", "LOGIN_REPAIRED");

    // Assert
    await waitFor(
      () => readItem(request, cookie, itemId),
      (item) => item.errorCode === null,
      "the warning to be cleared",
    );
  });

  test("PENDING_DISCONNECT warns that the item needs re-authenticating", async ({
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

    // Act
    await fireSandboxWebhook(creds, accessToken, "ITEM", "PENDING_DISCONNECT");

    // Assert
    await waitFor(
      () => readItem(request, cookie, itemId),
      (item) => item.errorCode === "PENDING_DISCONNECT",
      "the pending-disconnect warning to be recorded",
    );
  });

  test("USER_PERMISSION_REVOKED is recorded and the item is kept", async ({
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

    // Act
    await fireSandboxWebhook(creds, accessToken, "ITEM", "USER_PERMISSION_REVOKED");

    // Assert: Plaid advises keeping the item so the user can re-grant access.
    const item = await waitFor(
      () => readItem(request, cookie, itemId),
      (i) => i.errorCode === "USER_PERMISSION_REVOKED",
      "the revoked permission to be recorded",
    );
    expect(item.id).toBe(itemId);
  });
});
