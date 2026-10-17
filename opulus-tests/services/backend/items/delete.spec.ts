import { expect, test } from "@playwright/test";
import { withSession } from "../../../shared/client.js";
import { readItemAccessToken } from "../../../shared/db.js";
import { expectOk, expectStatus } from "../../../shared/assertions.js";
import {
  createAuthedUser,
  seedItemWithAccount,
  seedTransactions,
} from "../../../shared/fixtures/index.js";
import { failItemRemoval, removedAccessTokens, resetPlaidStub } from "../../../shared/plaid-stub.js";

/**
 * This file: the item delete endpoint. Deleting an item revokes its access token
 * at Plaid first (the Plaid stub), then deletes the item and everything linked
 * to it. Items are seeded directly into the isolated test DB, with a token the
 * stub accepts, and verified over HTTP.
 */
test.describe("DELETE /api/items/:id", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("answers 404 for an item owned by a different user and leaves its data intact", async ({
    request,
  }) => {
    // Arrange: `owner` has an item with an account and transactions; `intruder` is another user.
    const owner = await createAuthedUser(request);
    const intruder = await createAuthedUser(request);
    const seeded = await seedItemWithAccount(owner.userId);
    const { names } = await seedTransactions({
      userId: owner.userId,
      itemId: seeded.itemId,
      accountId: seeded.accountId,
      count: 2,
    });

    // Act
    const res = await request.delete(`/api/items/${seeded.itemId}`, {
      headers: withSession(intruder.cookie),
    });

    // Assert: not found, and the owner's item, account and transactions survive.
    await expectStatus(res, 404);

    const items = await request.get("/api/items", {
      headers: withSession(owner.cookie),
    });
    await expectOk(items);
    const ownerItems = (await items.json()).data.items as Array<{
      id: string;
      accounts: Array<{ id: string }>;
    }>;
    expect(ownerItems.map((i) => i.id)).toContain(seeded.itemId);
    expect(
      ownerItems.find((i) => i.id === seeded.itemId)?.accounts.map((a) => a.id),
    ).toContain(seeded.accountId);

    const txns = await request.get(
      `/api/transactions?itemId=${seeded.itemId}`,
      {
        headers: withSession(owner.cookie),
      },
    );
    await expectOk(txns);
    const txnNames = (
      (await txns.json()).data.transactions as Array<{ name: string }>
    ).map((t) => t.name);
    expect(txnNames).toEqual(expect.arrayContaining(names));
  });

  test("returns 404 for an unknown item id", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.delete("/api/items/does-not-exist", {
      headers: withSession(cookie),
    });

    // Assert
    await expectStatus(res, 404);
    expect((await res.json()).error).toBe("Not found");
  });

  test("revokes the item at Plaid, then deletes it with its accounts and transactions", async ({ request }) => {
    // Arrange: an item with an account and transactions.
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    await seedTransactions({ userId, itemId: item.itemId, accountId: item.accountId, count: 3 });
    const accessToken = await readItemAccessToken(item.itemId);

    // Act
    const res = await request.delete(`/api/items/${item.itemId}`, { headers: withSession(cookie) });

    // Assert: 204, Plaid was told to revoke that token, and the item, its accounts and its transactions are gone.
    await expectStatus(res, 204);
    expect(await removedAccessTokens()).toEqual([accessToken]);
    const items = await request.get("/api/items", { headers: withSession(cookie) });
    expect(((await items.json()).data.items as Array<{ id: string }>).map((i) => i.id)).not.toContain(item.itemId);
    const txns = await request.get("/api/transactions?limit=100", { headers: withSession(cookie) });
    expect((await txns.json()).data.transactions).toEqual([]);
  });

  test("only deletes the targeted item and leaves the user's other items intact", async ({ request }) => {
    // Arrange: two items for one user; the second has transactions.
    const { cookie, userId } = await createAuthedUser(request);
    const doomed = await seedItemWithAccount(userId);
    const other = await seedItemWithAccount(userId);
    const { names } = await seedTransactions({ userId, itemId: other.itemId, accountId: other.accountId, count: 2 });
    const doomedToken = await readItemAccessToken(doomed.itemId);

    // Act
    await expectStatus(await request.delete(`/api/items/${doomed.itemId}`, { headers: withSession(cookie) }), 204);

    // Assert: the other item, its account and its transactions are untouched, and only the doomed token was revoked.
    const items = (await (await request.get("/api/items", { headers: withSession(cookie) })).json()).data.items as Array<{
      id: string;
      accounts: Array<{ id: string }>;
    }>;
    expect(items.map((i) => i.id)).toEqual([other.itemId]);
    expect(items[0]!.accounts.map((a) => a.id)).toEqual([other.accountId]);
    const txns = await request.get(`/api/transactions?itemId=${other.itemId}&limit=100`, { headers: withSession(cookie) });
    expect(((await txns.json()).data.transactions as Array<{ name: string }>).map((t) => t.name)).toEqual(expect.arrayContaining(names));
    expect(await removedAccessTokens()).toEqual([doomedToken]);
  });

  test("returns 404 when deleting an item that was already deleted", async ({ request }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    await expectStatus(await request.delete(`/api/items/${item.itemId}`, { headers: withSession(cookie) }), 204);

    // Act
    const res = await request.delete(`/api/items/${item.itemId}`, { headers: withSession(cookie) });

    // Assert
    await expectStatus(res, 404);
  });

  test("keeps the item when Plaid will not revoke it", async ({ request }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    await failItemRemoval("INTERNAL_SERVER_ERROR");

    // Act
    const res = await request.delete(`/api/items/${item.itemId}`, { headers: withSession(cookie) });

    // Assert: refused, and nothing was deleted, so it can be tried again.
    expect(res.status()).toBeGreaterThanOrEqual(500);
    const items = await request.get("/api/items", { headers: withSession(cookie) });
    expect(((await items.json()).data.items as Array<{ id: string }>).map((i) => i.id)).toContain(item.itemId);
  });

  test("deletes an item Plaid no longer knows (it counts as already revoked)", async ({ request }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    await failItemRemoval("ITEM_NOT_FOUND");

    // Act
    const res = await request.delete(`/api/items/${item.itemId}`, { headers: withSession(cookie) });

    // Assert
    await expectStatus(res, 204);
  });
});
