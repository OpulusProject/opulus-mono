import { expect, test } from "@playwright/test";
import { ItemsResponseSchema } from "@opulus/core";
import { withSession } from "../../../shared/client.js";
import { expectOk, expectMatchesSchema } from "../../../shared/assertions.js";
import {
  createAuthedUser,
  seedCreditLiability,
  seedItemWithAccount,
} from "../../../shared/fixtures/index.js";
import { resetPlaidStub, setPlaidLiabilities } from "../../../shared/plaid-stub.js";
import {
  creditCardAccount,
  linkInstitution,
  liabilitiesFor,
  loanAccount,
  plaidAccount,
} from "../../../shared/scenarios/plaid.js";
import { uniqueId } from "../../../shared/client.js";

/**
 * This file: the linked-items list endpoint. Items have no create endpoint —
 * they are seeded directly into the isolated test DB (helpers/db.ts) and then
 * verified over HTTP.
 */
test.describe("GET /api/items", () => {
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
    await expectMatchesSchema(res, ItemsResponseSchema);
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

  test("flags an item that has new accounts to share, and only that item", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const flagged = await seedItemWithAccount(userId, {
      newAccountsAvailable: true,
    });
    const plain = await seedItemWithAccount(userId);

    // Act
    const res = await request.get("/api/items", {
      headers: withSession(cookie),
    });

    // Assert
    await expectOk(res);
    const items = (await res.json()).data.items as Array<{
      id: string;
      newAccountsAvailable: boolean;
    }>;
    expect(items.find((i) => i.id === flagged.itemId)?.newAccountsAvailable).toBe(true);
    expect(items.find((i) => i.id === plain.itemId)?.newAccountsAvailable).toBe(false);
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

  test("shows the liabilities Plaid reports for the credit card, mortgage and student loan of a freshly linked item", async ({ request }) => {
    // Arrange: Plaid describes a chequing account, a card, a mortgage and a student loan, with liabilities for the last three.
    await resetPlaidStub();
    const ids = { chequing: uniqueId("chq"), credit: uniqueId("cc"), mortgage: uniqueId("mtg"), student: uniqueId("stu") };
    await setPlaidLiabilities({ response: { liabilities: liabilitiesFor(ids) } });
    const { cookie } = await createAuthedUser(request);

    // Act: linking fetches and stores the liabilities.
    const { itemId } = await linkInstitution(request, cookie, {
      accounts: [plaidAccount(ids.chequing), creditCardAccount(ids.credit), loanAccount(ids.mortgage, "mortgage"), loanAccount(ids.student, "student")],
    });
    const res = await request.get("/api/items", { headers: withSession(cookie) });

    // Assert: each kind comes back with its details, and the chequing account has none.
    await expectOk(res);
    await expectMatchesSchema(res, ItemsResponseSchema);
    const item = ((await res.json()).data.items as Array<{ id: string; accounts: Array<{ type: string; liabilityDetails: Record<string, unknown> | null }> }>).find((i) => i.id === itemId)!;
    const byType = (type: string) => item.accounts.find((a) => a.type === type)?.liabilityDetails;
    expect(byType("credit")).toMatchObject({ kind: "credit", aprs: [{ type: "purchase_apr", percentage: 19.99 }], minimumPayment: 25 });
    expect(byType("depository")).toBeNull();
    const loans = item.accounts.filter((a) => a.type === "loan").map((a) => a.liabilityDetails);
    expect(loans).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "mortgage", interestRate: 3.99, minimumPayment: 1500 }),
      expect.objectContaining({ kind: "student", interestRate: 5.25, minimumPayment: 138.05 }),
    ]));
    for (const loan of loans) expect(Number.isNaN(Date.parse((loan as { syncedAt: string }).syncedAt))).toBe(false);
  });
});
