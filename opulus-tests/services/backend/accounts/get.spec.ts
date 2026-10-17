import { expect, test, type APIRequestContext } from "@playwright/test";
import { AccountsResponseSchema } from "@opulus/core";
import {
  expectMatchesSchema,
  expectOk,
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
  creditLimit: number | null;
  availableCredit: number | null;
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
  const res = await request.get(`/api/accounts${query}`, {
    headers: withSession(cookie),
  });
  await expectOk(res);
  // Every list call must match the documented shape exactly.
  await expectMatchesSchema(res, AccountsResponseSchema);
  return (await res.json()).data.accounts as AccountRow[];
}

/**
 * This file: the accounts list endpoint. Items and accounts have no create
 * endpoint, so they are seeded directly into the isolated test DB and verified
 * over HTTP.
 */
test.describe("GET /api/accounts", () => {
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
    const res = await request.get("/api/accounts?type=credit,loan", {
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

  test("returns the normalized type: brokerage as investment, an unrecognized type as other", async ({
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
    const accounts = await listAccounts(request, cookie);

    // Assert
    const byId = new Map(accounts.map((a) => [a.id, a]));
    expect(byId.get(brokerage.accountId)?.type).toBe("investment");
    expect(byId.get(unknown.accountId)?.type).toBe("other");
  });

  test("works out a credit account's limit and available credit when Plaid sent only one", async ({
    request,
  }) => {
    // Arrange: each card reports a different part of the picture.
    const { cookie, userId } = await createAuthedUser(request);
    const both = await seedItemWithAccount(userId, {
      account: {
        type: "credit",
        balanceCurrent: 250.5,
        balanceLimit: 5000,
        balanceAvailable: 4749.5,
      },
    });
    const onlyAvailable = await seedItemWithAccount(userId, {
      account: {
        type: "credit",
        balanceCurrent: 100.1,
        balanceLimit: null,
        balanceAvailable: 899.9,
      },
    });
    const onlyLimit = await seedItemWithAccount(userId, {
      account: {
        type: "credit",
        balanceCurrent: 300.3,
        balanceLimit: 1000,
        balanceAvailable: null,
      },
    });
    const neither = await seedItemWithAccount(userId, {
      account: {
        type: "credit",
        balanceCurrent: 50,
        balanceLimit: null,
        balanceAvailable: null,
      },
    });

    // Act
    const accounts = await listAccounts(request, cookie);

    // Assert
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const fields = (id: string) => {
      const account = byId.get(id);
      return [account?.creditLimit, account?.availableCredit];
    };
    expect(fields(both.accountId)).toEqual([5000, 4749.5]);
    expect(fields(onlyAvailable.accountId)).toEqual([1000, 899.9]);
    expect(fields(onlyLimit.accountId)).toEqual([1000, 699.7]);
    expect(fields(neither.accountId)).toEqual([null, null]);
  });

  test("leaves the credit fields null for accounts that are not credit cards", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const checking = await seedItemWithAccount(userId);
    const loan = await seedItemWithAccount(userId, {
      account: { type: "loan", balanceLimit: 5000 },
    });

    // Act
    const accounts = await listAccounts(request, cookie);

    // Assert
    const byId = new Map(accounts.map((a) => [a.id, a]));
    for (const { accountId } of [checking, loan]) {
      expect(byId.get(accountId)?.creditLimit).toBeNull();
      expect(byId.get(accountId)?.availableCredit).toBeNull();
    }
  });

  test("rejects an unknown type (400)", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.get("/api/accounts?type=savings", {
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
