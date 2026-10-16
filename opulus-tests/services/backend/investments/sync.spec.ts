import { expect, test, type APIRequestContext } from "@playwright/test";
import { SyncHoldingsResponseSchema } from "@opulus/core";
import { expectMatchesSchema, expectStatus, expectValidationError } from "../../../shared/assertions.js";
import { uniqueId, withSession } from "../../../shared/client.js";
import {
  countSecurities,
  createAuthedUser,
  readHoldings,
  seedHolding,
  seedItemWithAccount,
} from "../../../shared/fixtures/index.js";
import { resetPlaidStub, setPlaidHoldings } from "../../../shared/plaid-stub.js";

/** POST /api/investments/sync for one of the user's items. */
function sync(request: APIRequestContext, cookie: string, itemId: string) {
  return request.post("/api/investments/sync", {
    headers: withSession(cookie),
    data: { itemId },
  });
}

/** A user with an item that has one investment account (the stub answers for it). */
async function setup(request: APIRequestContext) {
  const { cookie, userId } = await createAuthedUser(request);
  const item = await seedItemWithAccount(userId, {
    account: { type: "investment", subtype: "brokerage" },
  });
  return { cookie, userId, item };
}

/** Plaid's holdings answer for an account, in Plaid's snake_case. */
const answer = (
  accountId: string,
  holdings: Record<string, unknown>[],
  securities: Record<string, unknown>[],
) => ({
  response: { accounts: [{ account_id: accountId }], holdings, securities },
});

const apple = (id: string) => ({
  security_id: id,
  name: "Apple Inc.",
  ticker_symbol: "AAPL",
  type: "equity",
  is_cash_equivalent: false,
  iso_currency_code: "USD",
  close_price: 189.5,
  close_price_as_of: "2026-10-14",
});
const cash = (id: string) => ({
  security_id: id,
  name: "Cash",
  ticker_symbol: "CAD",
  type: "cash",
  is_cash_equivalent: true,
  iso_currency_code: "CAD",
  close_price: null,
  close_price_as_of: null,
});

/**
 * This file: syncing an item's investment holdings from Plaid (answered by the
 * Plaid stub): what is stored, that a sync replaces what an account held, and
 * what happens when the institution has no investments to give.
 */
test.describe("POST /api/investments/sync", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/investments/sync", { data: { itemId: "x" } });

    await expectStatus(res, 401);
  });

  test("rejects a missing itemId (validation)", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    const res = await request.post("/api/investments/sync", {
      headers: withSession(cookie),
      data: {},
    });

    await expectValidationError(res);
  });

  test("rejects an item that does not exist (404)", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    await expectStatus(await sync(request, cookie, "no-such-item"), 404);
  });

  test("rejects another user's item (401)", async ({ request }) => {
    // Arrange
    const owner = await setup(request);
    const { cookie } = await createAuthedUser(request);

    // Act + Assert
    await expectStatus(await sync(request, cookie, owner.item.itemId), 401);
  });

  test("stores the securities and holdings Plaid reports", async ({ request }) => {
    // Arrange: a stock with a cost basis and cash with none.
    const { cookie, item } = await setup(request);
    const [aapl, cad] = [uniqueId("sec_aapl"), uniqueId("sec_cad")];
    await setPlaidHoldings(
      answer(
        item.providerAccountId,
        [
          {
            account_id: item.providerAccountId,
            security_id: aapl,
            quantity: 10,
            institution_price: 190.25,
            institution_price_as_of: "2026-10-14",
            institution_value: 1902.5,
            cost_basis: 1500,
            iso_currency_code: "USD",
          },
          {
            account_id: item.providerAccountId,
            security_id: cad,
            quantity: 250,
            institution_price: 1,
            institution_price_as_of: null,
            institution_value: 250,
            cost_basis: null,
            iso_currency_code: "CAD",
          },
        ],
        [apple(aapl), cash(cad)],
      ),
    );

    // Act
    const res = await sync(request, cookie, item.itemId);

    // Assert
    const body = await expectMatchesSchema(res, SyncHoldingsResponseSchema);
    expect(body.data).toEqual({ status: "synced", holdings: 2, securities: 2 });
    const stored = await readHoldings(item.itemId);
    expect(stored.map((h) => h.security.tickerSymbol)).toEqual(["AAPL", "CAD"]);
    expect(stored[0]).toMatchObject({ accountId: item.accountId, isoCurrencyCode: "USD" });
    expect(Number(stored[0]!.quantity)).toBe(10);
    expect(Number(stored[0]!.institutionPrice)).toBe(190.25);
    expect(Number(stored[0]!.institutionValue)).toBe(1902.5);
    expect(Number(stored[0]!.costBasis)).toBe(1500);
    expect(stored[0]!.security).toMatchObject({ name: "Apple Inc.", type: "equity", isCashEquivalent: false });
    expect(Number(stored[0]!.security.closePrice)).toBe(189.5);
    expect(stored[1]!.costBasis).toBeNull();
    expect(stored[1]!.security.isCashEquivalent).toBe(true);
  });

  test("replaces what the account held: updated holdings change, sold ones go", async ({
    request,
  }) => {
    // Arrange: the account held two securities; Plaid now reports one of them, with a new quantity.
    const { cookie, userId, item } = await setup(request);
    const [aapl, msft] = [uniqueId("sec_aapl"), uniqueId("sec_msft")];
    await seedHolding({ userId, itemId: item.itemId, accountId: item.accountId, plaidSecurityId: msft, tickerSymbol: "MSFT" });
    await seedHolding({ userId, itemId: item.itemId, accountId: item.accountId, plaidSecurityId: aapl, tickerSymbol: "AAPL", quantity: 1 });
    await setPlaidHoldings(
      answer(
        item.providerAccountId,
        [
          {
            account_id: item.providerAccountId,
            security_id: aapl,
            quantity: 7,
            institution_price: 200,
            institution_value: 1400,
            cost_basis: null,
            iso_currency_code: "USD",
          },
        ],
        [apple(aapl)],
      ),
    );

    // Act
    await sync(request, cookie, item.itemId);

    // Assert: MSFT (sold) is gone, AAPL has the new quantity (updated, not duplicated).
    const stored = await readHoldings(item.itemId);
    expect(stored.map((h) => h.security.tickerSymbol)).toEqual(["AAPL"]);
    expect(Number(stored[0]!.quantity)).toBe(7);
  });

  test("an account that sold everything ends up with no holdings", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId, item } = await setup(request);
    await seedHolding({ userId, itemId: item.itemId, accountId: item.accountId, plaidSecurityId: uniqueId("sec") });
    await setPlaidHoldings(answer(item.providerAccountId, [], []));

    // Act
    const res = await sync(request, cookie, item.itemId);

    // Assert
    const body = await expectMatchesSchema(res, SyncHoldingsResponseSchema);
    expect(body.data).toEqual({ status: "synced", holdings: 0, securities: 0 });
    expect(await readHoldings(item.itemId)).toEqual([]);
  });

  test("leaves the stored holdings alone when the institution has no investments to give", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId, item } = await setup(request);
    await seedHolding({ userId, itemId: item.itemId, accountId: item.accountId, plaidSecurityId: uniqueId("sec") });
    await setPlaidHoldings({ error_code: "PRODUCTS_NOT_SUPPORTED" });

    // Act
    const res = await sync(request, cookie, item.itemId);

    // Assert: a normal answer saying so, and nothing was removed.
    const body = await expectMatchesSchema(res, SyncHoldingsResponseSchema);
    expect(body.data).toEqual({ status: "unavailable", reason: "PRODUCTS_NOT_SUPPORTED" });
    expect(await readHoldings(item.itemId)).toHaveLength(1);
  });

  test("ignores a holding in an account that is not ours or in a security Plaid did not describe", async ({
    request,
  }) => {
    // Arrange
    const { cookie, item } = await setup(request);
    const [aapl, unknown] = [uniqueId("sec_aapl"), uniqueId("sec_unknown")];
    await setPlaidHoldings({
      response: {
        accounts: [{ account_id: item.providerAccountId }],
        holdings: [
          { account_id: "someone-elses-account", security_id: aapl, quantity: 1, institution_price: 1, institution_value: 1 },
          { account_id: item.providerAccountId, security_id: unknown, quantity: 1, institution_price: 1, institution_value: 1 },
        ],
        securities: [apple(aapl)],
      },
    });

    // Act
    await sync(request, cookie, item.itemId);

    // Assert
    expect(await readHoldings(item.itemId)).toEqual([]);
  });

  test("shares one security row between users who hold it", async ({ request }) => {
    // Arrange: two users hold the same security.
    const securityId = uniqueId("sec_shared");
    const [a, b] = [await setup(request), await setup(request)];
    for (const user of [a, b]) {
      await setPlaidHoldings(
        answer(
          user.item.providerAccountId,
          [
            {
              account_id: user.item.providerAccountId,
              security_id: securityId,
              quantity: 3,
              institution_price: 10,
              institution_value: 30,
              iso_currency_code: "USD",
            },
          ],
          [apple(securityId)],
        ),
      );
      await sync(request, user.cookie, user.item.itemId);
    }

    // Assert: each has a holding, and the security is stored once.
    expect(await readHoldings(a.item.itemId)).toHaveLength(1);
    expect(await readHoldings(b.item.itemId)).toHaveLength(1);
    expect(await countSecurities(securityId)).toBe(1);
  });
});
