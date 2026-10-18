import { expect, test, type APIRequestContext } from "@playwright/test";
import { expectOk } from "../../../shared/assertions.js";
import { uniqueId } from "../../../shared/client.js";
import { createAuthedUser, readInvestmentTransactions, readInvestmentTransactionsSyncedAt } from "../../../shared/fixtures/index.js";
import { investmentTransactionRequests, resetPlaidStub, setPlaidInvestmentTransactions } from "../../../shared/plaid-stub.js";
import { apple, buy, daysAgo, dividend, transactionsAnswer } from "../../../shared/scenarios/plaid-investments.js";
import { linkInstitution, plaidAccount, updateItemAccounts } from "../../../shared/scenarios/plaid.js";

/** A brokerage account in Plaid's shape, as the stub describes it to the accounts call. */
const brokerage = (id: string) =>
  plaidAccount(id, {
    name: `Brokerage ${id}`,
    type: "investment",
    subtype: "brokerage",
    mask: "1234",
    balances: { available: null, current: 5000, limit: null, iso_currency_code: "CAD", unofficial_currency_code: null },
  });

/** Link a brokerage with these accounts; investment transactions are synced as part of linking. Returns the item's id. */
async function link(request: APIRequestContext, cookie: string, accountIds: string[]) {
  const { itemId } = await linkInstitution(request, cookie, {
    accounts: accountIds.map(brokerage),
    institutionName: "Stub Brokerage",
  });
  return itemId;
}

/**
 * This file: what an item's investment transactions look like after the backend
 * syncs them, which it does when an institution is linked and again when its
 * accounts are updated (answered by the Plaid stub). A sync replaces the period
 * it fetched, and an institution with no investment transactions to give never
 * fails linking or updating.
 *
 * Test cases:
 * - stores the transactions and securities Plaid reports when an institution is linked
 * - fetches every page when there are more transactions than fit in one
 * - links an institution that has no investment transactions to give, with none stored
 * - ignores a transaction in an account that is not the item's
 * - re-reads the recent past when its accounts are updated: corrected transactions change, cancelled ones go
 * - leaves the stored transactions alone when the institution can no longer give them
 */
test.describe("investment transactions synced by linking and updating (Plaid stub)", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("stores the transactions and securities Plaid reports when an institution is linked", async ({ request }) => {
    // Arrange: a buy and a dividend, and a contribution that involves no security.
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    const aapl = uniqueId("sec_aapl");
    await setPlaidInvestmentTransactions(
      transactionsAnswer(
        [
          buy(account, uniqueId("it"), aapl, daysAgo(20), 10, 190.25),
          dividend(account, uniqueId("it"), aapl, daysAgo(8), 12.5),
          {
            investment_transaction_id: uniqueId("it"),
            account_id: account,
            security_id: null,
            date: daysAgo(30),
            name: "Contribution",
            type: "cash",
            subtype: "contribution",
            quantity: 0,
            price: 0,
            amount: -500,
            fees: null,
            iso_currency_code: "CAD",
          },
        ],
        [apple(aapl)],
      ),
    );

    // Act
    const itemId = await link(request, cookie, [account]);

    // Assert
    const stored = await readInvestmentTransactions(itemId);
    expect(stored.map((t) => t.subtype)).toEqual(["contribution", "buy", "dividend"]);
    expect(stored[0]).toMatchObject({ securityId: null, quantity: null, price: null, isoCurrencyCode: "CAD" });
    expect(Number(stored[0]!.amount)).toBe(-500);
    expect(stored[1]!.security).toMatchObject({ tickerSymbol: "AAPL" });
    expect([Number(stored[1]!.quantity), Number(stored[1]!.price), Number(stored[1]!.amount)]).toEqual([10, 190.25, 1902.5]);
    expect(Number(stored[2]!.amount)).toBe(-12.5);
    expect(await readInvestmentTransactionsSyncedAt(itemId)).not.toBeNull();
  });

  test("fetches every page when there are more transactions than fit in one", async ({ request }) => {
    // Arrange: 1,100 transactions, which Plaid hands out 500 at a time.
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    const aapl = uniqueId("sec_aapl");
    const prefix = uniqueId("it");
    await setPlaidInvestmentTransactions(
      transactionsAnswer(
        Array.from({ length: 1100 }, (_, i) => buy(account, `${prefix}_${i}`, aapl, daysAgo(1 + (i % 300)))),
        [apple(aapl)],
      ),
    );

    // Act
    const itemId = await link(request, cookie, [account]);

    // Assert
    expect(await readInvestmentTransactions(itemId)).toHaveLength(1100);
    expect((await investmentTransactionRequests()).map((r) => (r.options as { offset: number }).offset)).toEqual([0, 500, 1000]);
  });

  test("links an institution that has no investment transactions to give, with none stored", async ({ request }) => {
    // Arrange: Plaid says the product is not supported for this item.
    const { cookie } = await createAuthedUser(request);
    await setPlaidInvestmentTransactions({ error_code: "PRODUCTS_NOT_SUPPORTED" });

    // Act
    const itemId = await link(request, cookie, [uniqueId("acct")]);

    // Assert: linking worked, and nothing was stored.
    expect(await readInvestmentTransactions(itemId)).toEqual([]);
    expect(await readInvestmentTransactionsSyncedAt(itemId)).toBeNull();
  });

  test("ignores a transaction in an account that is not the item's", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    const aapl = uniqueId("sec_aapl");
    await setPlaidInvestmentTransactions(
      transactionsAnswer(
        [buy(account, uniqueId("it"), aapl, daysAgo(5), 3, 190), buy("not-this-items-account", uniqueId("it"), aapl, daysAgo(5), 99, 190)],
        [apple(aapl)],
      ),
    );

    // Act
    const itemId = await link(request, cookie, [account]);

    // Assert: only the first is stored.
    const stored = await readInvestmentTransactions(itemId);
    expect(stored).toHaveLength(1);
    expect(Number(stored[0]!.quantity)).toBe(3);
  });

  test("re-reads the recent past when its accounts are updated: corrected transactions change, cancelled ones go", async ({ request }) => {
    // Arrange: linked with an old buy and two recent ones.
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    const aapl = uniqueId("sec_aapl");
    const [old, kept, cancelled] = [uniqueId("it_old"), uniqueId("it_kept"), uniqueId("it_cancelled")];
    await setPlaidInvestmentTransactions(
      transactionsAnswer(
        [buy(account, old, aapl, daysAgo(200)), buy(account, kept, aapl, daysAgo(5), 10, 100), buy(account, cancelled, aapl, daysAgo(4))],
        [apple(aapl)],
      ),
    );
    const itemId = await link(request, cookie, [account]);

    // Act: Plaid now reports a correction and a cancellation, for the last month.
    await setPlaidInvestmentTransactions(transactionsAnswer([buy(account, kept, aapl, daysAgo(5), 12, 100)], [apple(aapl)]));
    await expectOk(await updateItemAccounts(request, cookie, itemId));

    // Assert: the old one stays (outside what was re-read), the corrected one changed, the cancelled one is gone.
    const stored = await readInvestmentTransactions(itemId);
    expect(stored.map((t) => t.plaidInvestmentTransactionId)).toEqual([old, kept]);
    expect(Number(stored[1]!.quantity)).toBe(12);
    expect((await investmentTransactionRequests()).at(-1)).toMatchObject({ start_date: daysAgo(30) });
  });

  test("leaves the stored transactions alone when the institution can no longer give them", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    const aapl = uniqueId("sec_aapl");
    await setPlaidInvestmentTransactions(transactionsAnswer([buy(account, uniqueId("it"), aapl, daysAgo(5))], [apple(aapl)]));
    const itemId = await link(request, cookie, [account]);

    // Act: the update finds the product needs consent again.
    await setPlaidInvestmentTransactions({ error_code: "ADDITIONAL_CONSENT_REQUIRED" });
    await expectOk(await updateItemAccounts(request, cookie, itemId));

    // Assert: what was stored stays, and the update itself succeeded.
    expect(await readInvestmentTransactions(itemId)).toHaveLength(1);
  });
});
