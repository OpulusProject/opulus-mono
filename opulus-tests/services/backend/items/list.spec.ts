import { expect, test } from "@playwright/test";
import { withSession } from "../../../shared/client.js";
import { expectOk, expectStatus } from "../../../shared/assertions.js";
import {
  createAuthedUser,
  seedCreditLiability,
  seedItemWithAccount,
} from "../../../shared/fixtures/index.js";

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
    const res = await request.get("/api/items", {
      headers: withSession(cookie),
    });

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
    const res = await request.get("/api/items", {
      headers: withSession(cookie),
    });

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
      errorType: null,
      errorCode: null,
      errorMessage: null,
      displayMessage: null,
      syncedAt: null,
    });
    expect(items[0].accounts).toEqual([
      expect.objectContaining({
        id: seeded.accountId,
        name: seeded.accountName,
      }),
    ]);
  });

  test("returns the account details needed to display it", async ({
    request,
  }) => {
    // Arrange: a credit card with a limit, mask, and currency.
    const { cookie, userId } = await createAuthedUser(request);
    const card = await seedItemWithAccount(userId, {
      account: {
        officialName: "Platinum Rewards Visa",
        type: "credit",
        subtype: "credit card",
        mask: "4242",
        balanceCurrent: 250.5,
        balanceAvailable: 4749.5,
        balanceLimit: 5000,
        isoCurrencyCode: "CAD",
      },
    });

    // Act
    const res = await request.get("/api/items", {
      headers: withSession(cookie),
    });

    // Assert
    await expectOk(res);
    const items = (await res.json()).data.items as Array<{
      id: string;
      accounts: Array<Record<string, unknown>>;
    }>;
    const item = items.find((i) => i.id === card.itemId);
    expect(item?.accounts).toEqual([
      expect.objectContaining({
        id: card.accountId,
        officialName: "Platinum Rewards Visa",
        type: "credit",
        subtype: "credit card",
        mask: "4242",
        balanceCurrent: 250.5,
        balanceAvailable: 4749.5,
        balanceLimit: 5000,
        isoCurrencyCode: "CAD",
      }),
    ]);
  });

  test("returns liability details for an account that has them, and null otherwise", async ({
    request,
  }) => {
    // Arrange: one credit card with a stored liability, one checking account without.
    const { cookie, userId } = await createAuthedUser(request);
    const card = await seedItemWithAccount(userId, {
      account: { type: "credit", subtype: "credit card", mask: "4242" },
    });
    const liability = await seedCreditLiability({
      userId,
      itemId: card.itemId,
      accountId: card.accountId,
    });
    const checking = await seedItemWithAccount(userId);

    // Act
    const res = await request.get("/api/items", {
      headers: withSession(cookie),
    });

    // Assert
    await expectOk(res);
    const items = (await res.json()).data.items as Array<{
      id: string;
      accounts: Array<{
        id: string;
        liabilityDetails: Record<string, unknown> | null;
      }>;
    }>;
    const cardAccount = items
      .find((i) => i.id === card.itemId)
      ?.accounts.find((a) => a.id === card.accountId);
    expect(cardAccount?.liabilityDetails).toMatchObject({
      kind: "credit",
      isOverdue: false,
      nextPaymentDueDate: liability.nextPaymentDueDate.toISOString(),
      minimumPayment: liability.minimumPayment,
      lastStatementBalance: liability.lastStatementBalance,
      aprs: [
        expect.objectContaining({
          type: "purchase_apr",
          percentage: liability.aprPercentage,
        }),
      ],
    });
    const checkingAccount = items
      .find((i) => i.id === checking.itemId)
      ?.accounts.find((a) => a.id === checking.accountId);
    expect(checkingAccount?.liabilityDetails).toBeNull();
  });

  test("returns stored Plaid error columns", async ({ request }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId, {
      errorType: "ITEM_ERROR",
      errorCode: "ITEM_LOGIN_REQUIRED",
      errorMessage: "the login details of this item have changed",
    });

    // Act
    const res = await request.get("/api/items", {
      headers: withSession(cookie),
    });

    // Assert
    await expectOk(res);
    const items = (await res.json()).data.items as Array<{
      errorType: string | null;
      errorCode: string | null;
      errorMessage: string | null;
    }>;
    expect(items[0]).toMatchObject({
      errorType: "ITEM_ERROR",
      errorCode: "ITEM_LOGIN_REQUIRED",
      errorMessage: "the login details of this item have changed",
    });
  });

  test("exposes syncedAt as an ISO timestamp when set", async ({ request }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const syncedAt = new Date("2026-03-15T12:00:00.000Z");
    await seedItemWithAccount(userId, { syncedAt });

    // Act
    const res = await request.get("/api/items", {
      headers: withSession(cookie),
    });

    // Assert
    await expectOk(res);
    const items = (await res.json()).data.items as Array<{
      syncedAt: string | null;
    }>;
    expect(items[0].syncedAt).toBe(syncedAt.toISOString());
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
