import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  expectOk,
  expectStatus,
  expectValidationError,
} from "../../../shared/assertions.js";
import { uniqueId, withSession } from "../../../shared/client.js";
import {
  createAuthedUser,
  seedCreditLiability,
  seedItemWithAccount,
} from "../../../shared/fixtures/index.js";

interface AccountRow {
  id: string;
  name: string;
  type: string;
  connection: {
    id: string;
    institutionName: string | null;
    errorCode: string | null;
  };
  liabilityDetails: Record<string, unknown> | null;
}

async function listAccounts(
  request: APIRequestContext,
  cookie: string,
  query = "",
): Promise<AccountRow[]> {
  const res = await request.get(`/api/bank-accounts${query}`, {
    headers: withSession(cookie),
  });
  await expectOk(res);
  return (await res.json()).data.accounts as AccountRow[];
}

/**
 * This file: the bank accounts list endpoint. Items and accounts have no create
 * endpoint, so they are seeded directly into the isolated test DB and verified
 * over HTTP.
 */
test.describe("GET /api/bank-accounts", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.get("/api/bank-accounts");
    await expectStatus(res, 401);
  });

  test("returns an empty list for a user with no accounts", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act + Assert
    expect(await listAccounts(request, cookie)).toEqual([]);
  });

  test("returns accounts across connections, each with its connection, sorted by name", async ({
    request,
  }) => {
    // Arrange: two connections, the second with a Plaid error.
    const { cookie, userId } = await createAuthedUser(request);
    const suffix = uniqueId("n");
    const first = await seedItemWithAccount(userId, {
      accountName: `b-${suffix}`,
    });
    const second = await seedItemWithAccount(userId, {
      accountName: `a-${suffix}`,
      errorCode: "ITEM_LOGIN_REQUIRED",
    });

    // Act
    const accounts = await listAccounts(request, cookie);

    // Assert: sorted by name, each carrying its own connection.
    expect(accounts.map((a) => a.name)).toEqual([
      second.accountName,
      first.accountName,
    ]);
    expect(accounts[0].connection).toEqual({
      id: second.itemId,
      institutionName: second.institutionName,
      errorCode: "ITEM_LOGIN_REQUIRED",
    });
    expect(accounts[1].connection).toEqual({
      id: first.itemId,
      institutionName: first.institutionName,
      errorCode: null,
    });
  });

  test("filters by a single type", async ({ request }) => {
    // Arrange: a depository, a credit, and a loan account.
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId);
    const card = await seedItemWithAccount(userId, {
      account: { type: "credit", subtype: "credit card" },
    });
    await seedItemWithAccount(userId, {
      account: { type: "loan", subtype: "mortgage" },
    });

    // Act
    const accounts = await listAccounts(request, cookie, "?type=credit");

    // Assert
    expect(accounts.map((a) => a.id)).toEqual([card.accountId]);
  });

  test("accepts several types by repeating the type parameter", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId);
    const card = await seedItemWithAccount(userId, {
      account: { type: "credit" },
    });
    const loan = await seedItemWithAccount(userId, {
      account: { type: "loan" },
    });

    // Act
    const accounts = await listAccounts(
      request,
      cookie,
      "?type=credit&type=loan",
    );

    // Assert
    expect(accounts.map((a) => a.id).sort()).toEqual(
      [card.accountId, loan.accountId].sort(),
    );
  });

  test("rejects a comma-separated list of types (400)", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.get("/api/bank-accounts?type=credit,loan", {
      headers: withSession(cookie),
    });

    // Assert
    await expectValidationError(res);
  });

  test("treats the legacy brokerage type as investment, and unrecognized types as other", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const brokerage = await seedItemWithAccount(userId, {
      account: { type: "brokerage" },
    });
    const unknown = await seedItemWithAccount(userId, {
      account: { type: "crypto" },
    });

    // Act
    const investments = await listAccounts(request, cookie, "?type=investment");
    const other = await listAccounts(request, cookie, "?type=other");

    // Assert
    expect(investments.map((a) => a.id)).toEqual([brokerage.accountId]);
    expect(other.map((a) => a.id)).toEqual([unknown.accountId]);
  });

  test("rejects an unknown type (400)", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.get("/api/bank-accounts?type=savings", {
      headers: withSession(cookie),
    });

    // Assert
    await expectValidationError(res);
  });

  test("includes liability details for an account that has them, and null otherwise", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const card = await seedItemWithAccount(userId, {
      account: { type: "credit" },
    });
    await seedCreditLiability({
      userId,
      itemId: card.itemId,
      accountId: card.accountId,
    });
    const checking = await seedItemWithAccount(userId);

    // Act
    const accounts = await listAccounts(request, cookie);

    // Assert
    const byId = new Map(accounts.map((a) => [a.id, a]));
    expect(byId.get(card.accountId)?.liabilityDetails).toMatchObject({
      kind: "credit",
    });
    expect(byId.get(checking.accountId)?.liabilityDetails).toBeNull();
  });

  test("scopes results to the requesting user (does not leak another user's accounts)", async ({
    request,
  }) => {
    // Arrange
    const alice = await createAuthedUser(request);
    const bob = await createAuthedUser(request);
    const aliceAccount = await seedItemWithAccount(alice.userId);
    const bobAccount = await seedItemWithAccount(bob.userId);

    // Act: read as Alice.
    const ids = (await listAccounts(request, alice.cookie)).map((a) => a.id);

    // Assert
    expect(ids).toContain(aliceAccount.accountId);
    expect(ids).not.toContain(bobAccount.accountId);
  });
});
