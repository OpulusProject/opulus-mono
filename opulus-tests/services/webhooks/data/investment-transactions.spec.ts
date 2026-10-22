import { expect, test } from "@playwright/test";
import { uniqueId } from "../../../shared/client.js";
import {
  readInvestmentTransactions,
  readInvestmentTransactionsSyncedAt,
  readSecurityPrices,
  readWebhookEvents,
  seedLinkedItem,
} from "../../../shared/fixtures/index.js";
import { investmentTransactionRequests, resetPlaidStub, setPlaidInvestmentTransactions } from "../../../shared/plaid-stub.js";
import { apple, buy, daysAgo, dividend, transactionsAnswer } from "../../../shared/scenarios/plaid-investments.js";
import { resetYahooStub } from "../../../shared/yahoo-stub.js";
import { deliverWebhook } from "../helpers/fixtures/index.js";

const linkedItem = seedLinkedItem;

const investmentsWebhook = (plaidItemId: string, code = "DEFAULT_UPDATE", news = 1) => ({
  webhook_type: "INVESTMENTS_TRANSACTIONS",
  webhook_code: code,
  item_id: plaidItemId,
  new_investments_transactions: news,
  canceled_investments_transactions: 0,
});

/**
 * This file: what the worker does with an INVESTMENTS_TRANSACTIONS webhook.
 * DEFAULT_UPDATE says Plaid found new investment transactions; HISTORICAL_UPDATE
 * says the item's full history has been extracted after it was linked. Either
 * way the worker asks Plaid (the stub answers with what the test set) for the
 * period since the last sync and stores it in place of what was there. What it
 * stored is read from the test DB.
 *
 * Test cases:
 * - stores the transactions and securities Plaid reports, with Plaid's sign (a buy out, a dividend in)
 * - prices a security that only appears in the transactions, such as one sold before the account was linked
 * - asks for 24 months the first time and records when it synced
 * - a HISTORICAL_UPDATE syncs like a DEFAULT_UPDATE
 * - asks only for the time since the last sync (and a month before it) the next time
 * - replaces what falls in that period, dropping a transaction Plaid no longer reports, and keeps older ones
 * - keeps what it had when Plaid has no investment transactions to give for the item
 * - handles an INVESTMENTS_TRANSACTIONS code it has no action for (processed, nothing stored)
 */
test.describe("INVESTMENTS_TRANSACTIONS webhooks", () => {
  test.beforeEach(async ({ request }) => {
    await resetPlaidStub();
    await resetYahooStub(request);
  });

  test("stores the transactions and securities Plaid reports, with Plaid's sign (a buy out, a dividend in)", async ({ request }) => {
    // Arrange
    const item = await linkedItem();
    const aapl = uniqueId("sec_aapl");
    await setPlaidInvestmentTransactions(
      transactionsAnswer(
        [buy(item.providerAccountId, uniqueId("it"), aapl, daysAgo(10), 10, 190), dividend(item.providerAccountId, uniqueId("it"), aapl, daysAgo(3), 12.5)],
        [apple(aapl)],
        [item.providerAccountId],
      ),
    );

    // Act
    await deliverWebhook(request, investmentsWebhook(item.plaidItemId, "DEFAULT_UPDATE", 2));

    // Assert
    const stored = await readInvestmentTransactions(item.itemId);
    expect(stored.map((t) => [t.type, t.subtype])).toEqual([
      ["buy", "buy"],
      ["cash", "dividend"],
    ]);
    expect(stored[0]).toMatchObject({ itemId: item.itemId, accountId: item.accountId, isoCurrencyCode: "USD" });
    expect(stored[0]!.security).toMatchObject({ tickerSymbol: "AAPL" });
    expect([Number(stored[0]!.quantity), Number(stored[0]!.price), Number(stored[0]!.amount)]).toEqual([10, 190, 1900]);
    expect(Number(stored[1]!.amount)).toBe(-12.5);
  });

  test("prices a security that only appears in the transactions, such as one sold before the account was linked", async ({ request }) => {
    // Arrange: bought and sold in the period, so no holding has it.
    const item = await linkedItem();
    const id = uniqueId("sec_sold");
    const ticker = uniqueId("").replace(/[^a-f]/g, "").toUpperCase().padEnd(6, "Q").slice(0, 6) + "Z";
    await setPlaidInvestmentTransactions(
      transactionsAnswer([buy(item.providerAccountId, uniqueId("it"), id, daysAgo(40), 10, 190)], [{ ...apple(id), ticker_symbol: ticker }], [item.providerAccountId]),
    );

    // Act
    await deliverWebhook(request, investmentsWebhook(item.plaidItemId));

    // Assert: priced in the background, with its history.
    const [stored] = await readInvestmentTransactions(item.itemId);
    await expect.poll(async () => (await readSecurityPrices(stored!.security!.id)).length, { timeout: 15_000 }).toBeGreaterThan(450);
  });

  test("asks for 24 months the first time and records when it synced", async ({ request }) => {
    // Arrange
    const item = await linkedItem();
    await setPlaidInvestmentTransactions(transactionsAnswer([], [], [item.providerAccountId]));
    expect(await readInvestmentTransactionsSyncedAt(item.itemId)).toBeNull();

    // Act
    await deliverWebhook(request, investmentsWebhook(item.plaidItemId));

    // Assert
    expect(await investmentTransactionRequests()).toMatchObject([{ start_date: daysAgo(730), end_date: daysAgo(0) }]);
    expect(await readInvestmentTransactionsSyncedAt(item.itemId)).not.toBeNull();
  });

  test("a HISTORICAL_UPDATE syncs like a DEFAULT_UPDATE", async ({ request }) => {
    // Arrange
    const item = await linkedItem();
    const aapl = uniqueId("sec_aapl");
    await setPlaidInvestmentTransactions(
      transactionsAnswer([buy(item.providerAccountId, uniqueId("it"), aapl, daysAgo(400))], [apple(aapl)], [item.providerAccountId]),
    );

    // Act
    await deliverWebhook(request, investmentsWebhook(item.plaidItemId, "HISTORICAL_UPDATE", 1));

    // Assert
    expect(await readInvestmentTransactions(item.itemId)).toHaveLength(1);
  });

  test("asks only for the time since the last sync (and a month before it) the next time", async ({ request }) => {
    // Arrange: a first sync has happened.
    const item = await linkedItem();
    await setPlaidInvestmentTransactions(transactionsAnswer([], [], [item.providerAccountId]));
    await deliverWebhook(request, investmentsWebhook(item.plaidItemId));

    // Act
    await deliverWebhook(request, investmentsWebhook(item.plaidItemId, "DEFAULT_UPDATE", 2));

    // Assert
    const requests = await investmentTransactionRequests();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ start_date: daysAgo(30), end_date: daysAgo(0) });
  });

  test("replaces what falls in that period, dropping a transaction Plaid no longer reports, and keeps older ones", async ({ request }) => {
    // Arrange: a first sync stores an old buy and two recent transactions.
    const item = await linkedItem();
    const aapl = uniqueId("sec_aapl");
    const [old, kept, cancelled] = [uniqueId("it_old"), uniqueId("it_kept"), uniqueId("it_cancelled")];
    const account = item.providerAccountId;
    await setPlaidInvestmentTransactions(
      transactionsAnswer([buy(account, old, aapl, daysAgo(200)), buy(account, kept, aapl, daysAgo(5), 10, 100), buy(account, cancelled, aapl, daysAgo(4))], [apple(aapl)], [account]),
    );
    await deliverWebhook(request, investmentsWebhook(item.plaidItemId));

    // Act: the bank cancelled one and corrected the other (Plaid reports only the last month).
    await setPlaidInvestmentTransactions(transactionsAnswer([buy(account, kept, aapl, daysAgo(5), 12, 100)], [apple(aapl)], [account]));
    await deliverWebhook(request, investmentsWebhook(item.plaidItemId, "DEFAULT_UPDATE", 0));

    // Assert
    const stored = await readInvestmentTransactions(item.itemId);
    expect(stored.map((t) => t.plaidInvestmentTransactionId)).toEqual([old, kept]);
    expect(Number(stored[1]!.quantity)).toBe(12);
  });

  test("keeps what it had when Plaid has no investment transactions to give for the item", async ({ request }) => {
    // Arrange
    const item = await linkedItem();
    const aapl = uniqueId("sec_aapl");
    await setPlaidInvestmentTransactions(transactionsAnswer([buy(item.providerAccountId, uniqueId("it"), aapl, daysAgo(5))], [apple(aapl)], [item.providerAccountId]));
    await deliverWebhook(request, investmentsWebhook(item.plaidItemId));
    await setPlaidInvestmentTransactions({ error_code: "PRODUCT_NOT_READY" });

    // Act
    await deliverWebhook(request, investmentsWebhook(item.plaidItemId, "DEFAULT_UPDATE", 2));

    // Assert: handled (not failed and retried), and the transaction is still there.
    expect((await readWebhookEvents(item.plaidItemId)).map((e) => [e.status, e.attempts])).toEqual([
      ["processed", 1],
      ["processed", 1],
    ]);
    expect(await readInvestmentTransactions(item.itemId)).toHaveLength(1);
  });

  test("handles an INVESTMENTS_TRANSACTIONS code it has no action for (processed, nothing stored)", async ({ request }) => {
    // Arrange: Plaid would answer with transactions, if it were asked.
    const item = await linkedItem();
    const aapl = uniqueId("sec_aapl");
    await setPlaidInvestmentTransactions(transactionsAnswer([buy(item.providerAccountId, uniqueId("it"), aapl, daysAgo(5))], [apple(aapl)], [item.providerAccountId]));

    // Act
    await deliverWebhook(request, investmentsWebhook(item.plaidItemId, "SOMETHING_NEW"));

    // Assert
    expect(await readInvestmentTransactions(item.itemId)).toEqual([]);
    expect(await investmentTransactionRequests()).toEqual([]);
    expect(await readWebhookEvents(item.plaidItemId)).toMatchObject([{ status: "processed", attempts: 1 }]);
  });
});
