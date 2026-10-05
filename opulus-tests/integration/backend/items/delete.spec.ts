import { expect, test, type APIRequestContext } from "@playwright/test";

import { expectOk, expectStatus } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import {
  createAuthedUser,
  seedItemWithAccount,
  seedTransactions,
} from "../../../shared/fixtures/index.js";
import {
  createSandboxItem,
  requireSandboxCredentials,
} from "../helpers/plaidSandbox.js";

interface ItemRow {
  id: string;
  accounts: Array<{ id: string }>;
}

async function listItems(
  request: APIRequestContext,
  cookie: string,
): Promise<ItemRow[]> {
  const res = await request.get("/api/items", { headers: withSession(cookie) });
  await expectOk(res);
  return (await res.json()).data.items as ItemRow[];
}

async function listTransactionNames(
  request: APIRequestContext,
  cookie: string,
  itemId: string,
): Promise<string[]> {
  const res = await request.get(`/api/transactions?itemId=${itemId}&limit=100`, {
    headers: withSession(cookie),
  });
  await expectOk(res);
  return ((await res.json()).data.transactions as Array<{ name: string }>).map(
    (t) => t.name,
  );
}

/**
 * DELETE /api/items/:id — Plaid Sandbox round-trip.
 *
 * Deleting an item first revokes its access token with Plaid (/item/remove), so
 * the happy path needs a real sandbox-backed item: a seeded item with a fake
 * access token would be rejected by Plaid. The item and its accounts are
 * created through the backend's own POST /api/plaid/items. Transactions have no
 * create endpoint (they arrive via the Plaid webhook sync path), so they are
 * seeded into the isolated test DB against the real item's account. All
 * verification happens over HTTP.
 */
test.describe("DELETE /api/items/:id (sandbox)", () => {
  test("disconnects the item and deletes its accounts and transactions", async ({
    request,
  }) => {
    // Arrange: a real sandbox item for the user, with transactions on its account.
    const creds = requireSandboxCredentials();
    const { cookie, userId } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);
    const before = (await listItems(request, cookie)).find((i) => i.id === itemId);
    expect(before?.accounts.length).toBeGreaterThan(0);
    await seedTransactions({
      userId,
      itemId,
      accountId: before!.accounts[0].id,
      count: 3,
    });
    expect(await listTransactionNames(request, cookie, itemId)).toHaveLength(3);

    // Act
    const res = await request.delete(`/api/items/${itemId}`, {
      headers: withSession(cookie),
    });

    // Assert: 204, then the item, its accounts, and its transactions are all gone.
    await expectStatus(res, 204);
    expect((await listItems(request, cookie)).map((i) => i.id)).not.toContain(
      itemId,
    );
    expect(await listTransactionNames(request, cookie, itemId)).toEqual([]);
    const all = await request.get("/api/transactions?limit=100", {
      headers: withSession(cookie),
    });
    await expectOk(all);
    expect((await all.json()).data.transactions).toEqual([]);
  });

  test("only deletes the targeted item and leaves the user's other items intact", async ({
    request,
  }) => {
    // Arrange: one real sandbox item to delete, plus an unrelated seeded item
    // (with an account and transactions) belonging to the same user.
    const creds = requireSandboxCredentials();
    const { cookie, userId } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);
    const other = await seedItemWithAccount(userId);
    const { names } = await seedTransactions({
      userId,
      itemId: other.itemId,
      accountId: other.accountId,
      count: 2,
    });

    // Act
    const res = await request.delete(`/api/items/${itemId}`, {
      headers: withSession(cookie),
    });

    // Assert: the other item, its account, and its transactions are untouched.
    await expectStatus(res, 204);
    const items = await listItems(request, cookie);
    expect(items.map((i) => i.id)).toEqual([other.itemId]);
    expect(items[0].accounts.map((a) => a.id)).toEqual([other.accountId]);
    expect(await listTransactionNames(request, cookie, other.itemId)).toEqual(
      expect.arrayContaining(names),
    );
  });

  test("returns 404 when deleting an item that was already deleted", async ({
    request,
  }) => {
    // Arrange
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);
    await expectStatus(
      await request.delete(`/api/items/${itemId}`, {
        headers: withSession(cookie),
      }),
      204,
    );

    // Act
    const res = await request.delete(`/api/items/${itemId}`, {
      headers: withSession(cookie),
    });

    // Assert
    await expectStatus(res, 404);
  });

  test("rejects an intruder deleting another user's item (401) and keeps it linked", async ({
    request,
  }) => {
    // Arrange: a real sandbox item owned by `owner`; `intruder` tries to delete it.
    const creds = requireSandboxCredentials();
    const owner = await createAuthedUser(request);
    const intruder = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, owner.cookie, creds);

    // Act
    const res = await request.delete(`/api/items/${itemId}`, {
      headers: withSession(intruder.cookie),
    });

    // Assert: forbidden, and the item is still linked for its owner.
    await expectStatus(res, 401);
    expect((await listItems(request, owner.cookie)).map((i) => i.id)).toContain(
      itemId,
    );
  });
});
