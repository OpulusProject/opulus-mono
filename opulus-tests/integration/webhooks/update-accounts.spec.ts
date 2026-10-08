import { expect, test } from "@playwright/test";

import { withSession } from "../../shared/client.js";
import { expectOk } from "../../shared/assertions.js";
import { testDb } from "../../shared/db.js";
import { createAuthedUser } from "../../shared/fixtures/auth.js";
import { requireSandboxCredentials } from "../helpers/plaidSandbox.js";
import {
  fireNewAccountsAvailableOrSkip,
  fireSandboxWebhook,
  linkItemWithWebhook,
  readItem,
  waitFor,
} from "./helpers.js";

/**
 * What POST /api/items/:id/update-accounts does to the state that webhooks
 * stored. The state is put there by Plaid's sandbox firing real webhooks at
 * the receiver, not by writing to the database; the item itself is healthy at
 * Plaid throughout, which is the situation after a user finishes update mode.
 */
test.describe("update-accounts after webhooks (sandbox to receiver)", () => {
  async function updateAccounts(
    request: Parameters<typeof readItem>[0],
    cookie: string,
    itemId: string,
  ) {
    const res = await request.post(`/api/items/${itemId}/update-accounts`, {
      headers: withSession(cookie),
    });
    await expectOk(res);
    return (await res.json()).data as { created: number; updated: number };
  }

  test("clears a warning the receiver stored once the user has re-authenticated", async ({
    request,
  }) => {
    // Arrange: a webhook makes the receiver store a pending-disconnect warning.
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
      (item) => item.errorCode === "PENDING_DISCONNECT",
      "the warning to be stored",
    );

    // Act: what the frontend calls after the user completes update mode.
    await updateAccounts(request, cookie, itemId);

    // Assert
    expect((await readItem(request, cookie, itemId)).errorCode).toBeNull();
  });

  test("keeps the new-accounts prompt until new accounts are actually added", async ({
    request,
  }) => {
    // Arrange: a webhook flags the item as having new accounts to share.
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId, accessToken } = await linkItemWithWebhook(
      request,
      cookie,
      creds,
    );
    await fireNewAccountsAvailableOrSkip(test, creds, accessToken);
    await waitFor(
      () => readItem(request, cookie, itemId),
      (item) => item.newAccountsAvailable,
      "the item to be flagged",
    );

    // Act 1: the user finishes update mode but shares nothing new.
    const nothingNew = await updateAccounts(request, cookie, itemId);

    // Assert 1: nothing was added, so the prompt stays.
    expect(nothingNew.created).toBe(0);
    expect((await readItem(request, cookie, itemId)).newAccountsAvailable).toBe(
      true,
    );

    // Act 2: Plaid now returns an account we don't have. The sandbox can't add
    // an account to an existing item, so the missing account is simulated by
    // removing our row for one (the only direct database write in this suite).
    const db = testDb();
    const account = await db.account.findFirstOrThrow({ where: { itemId } });
    await db.account.delete({ where: { id: account.id } });
    const added = await updateAccounts(request, cookie, itemId);

    // Assert 2: it is added, and the prompt goes away.
    expect(added.created).toBe(1);
    expect((await readItem(request, cookie, itemId)).newAccountsAvailable).toBe(
      false,
    );
  });
});
