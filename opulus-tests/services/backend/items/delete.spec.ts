import { expect, test } from "@playwright/test";
import { withSession } from "../../../shared/client.js";
import { expectOk, expectStatus } from "../../../shared/assertions.js";
import {
  createAuthedUser,
  seedItemWithAccount,
  seedTransactions,
} from "../../../shared/fixtures/index.js";

/**
 * This file: the item delete endpoint, service-owned boundaries only. A
 * successful delete revokes the item with Plaid first, so the happy path lives
 * in the integration suite (integration/backend/items/delete.spec.ts). Here we
 * cover authentication and permission checks, which are rejected before Plaid
 * is ever contacted. Items are seeded directly into the isolated test DB (no
 * create endpoint) and verified over HTTP.
 */
test.describe("DELETE /api/items/:id", () => {
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
});
