import { expect, test } from "@playwright/test";
import { withSession } from "../helpers/client.js";
import { expectOk, expectStatus } from "../helpers/assertions.js";
import { createAuthedUser, seedItemWithAccount } from "../helpers/fixtures/index.js";

/**
 * This file: the linked-items list endpoint. Items have no create endpoint —
 * they are seeded directly into the isolated test DB (helpers/db.ts) and then
 * verified over HTTP.
 */
test.describe("GET /api/items", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.get("/api/items");
    await expectStatus(res, 401);
  });

  test("returns an empty list for a user who has linked nothing", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.get("/api/items", { headers: withSession(cookie) });

    // Assert
    await expectOk(res);
    const body = await res.json();
    expect(body.data.items).toEqual([]);
  });

  test("returns a seeded item with its account for its owner", async ({
    request,
  }) => {
    // Arrange: user via API, item+account seeded directly (no create endpoint).
    const { cookie, userId } = await createAuthedUser(request);
    const seeded = await seedItemWithAccount(userId);

    // Act
    const res = await request.get("/api/items", { headers: withSession(cookie) });

    // Assert
    await expectOk(res);
    const items = (await res.json()).data.items as Array<{
      id: string;
      institutionName: string;
      accounts: Array<{ id: string; name: string }>;
    }>;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: seeded.itemId,
      institutionName: seeded.institutionName,
    });
    expect(items[0].accounts).toEqual([
      expect.objectContaining({ id: seeded.accountId, name: seeded.accountName }),
    ]);
  });

  test("scopes results to the requesting user (does not leak another user's items)", async ({
    request,
  }) => {
    // Arrange: two users, each with their own seeded item.
    const alice = await createAuthedUser(request);
    const bob = await createAuthedUser(request);
    const aliceItem = await seedItemWithAccount(alice.userId);
    const bobItem = await seedItemWithAccount(bob.userId);

    // Act: read as Alice.
    const res = await request.get("/api/items", {
      headers: withSession(alice.cookie),
    });

    // Assert: only Alice's item is visible.
    await expectOk(res);
    const ids = ((await res.json()).data.items as Array<{ id: string }>).map(
      (i) => i.id,
    );
    expect(ids).toContain(aliceItem.itemId);
    expect(ids).not.toContain(bobItem.itemId);
  });
});
