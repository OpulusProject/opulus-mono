import { expect, test } from "@playwright/test";
import { uniqueId } from "../../../shared/client.js";
import { seedLinkedItem, readWebhookEvents, readHoldings, readSecurityPrices } from "../../../shared/fixtures/index.js";
import { resetPlaidStub, setPlaidHoldings } from "../../../shared/plaid-stub.js";
import { answer, apple, cash, holding } from "../../../shared/scenarios/plaid-investments.js";
import { resetYahooStub, yahooRequests } from "../../../shared/yahoo-stub.js";
import { deliverWebhook } from "../helpers/fixtures/index.js";

const linkedItem = seedLinkedItem;

const holdingsWebhook = (plaidItemId: string, newHoldings = 1) => ({
  webhook_type: "HOLDINGS",
  webhook_code: "DEFAULT_UPDATE",
  item_id: plaidItemId,
  new_holdings: newHoldings,
  updated_holdings: 0,
});

/**
 * This file: what the worker does with a HOLDINGS DEFAULT_UPDATE webhook, which
 * says an item's holdings changed. The worker asks Plaid (the stub answers with
 * what the test set) for the item's holdings and stores them in place of the old
 * ones. What it stored is read from the test DB.
 *
 * Test cases:
 * - stores the holdings and securities Plaid reports
 * - replaces what it stored before, dropping holdings Plaid no longer reports
 * - prices the securities it stores at once: a quote, then two years of history
 * - prices only the securities that have no price yet
 * - keeps what it had when Plaid has no investments to give for the item
 * - handles a HOLDINGS code it has no action for (processed, nothing stored)
 */
test.describe("HOLDINGS webhooks", () => {
  test.beforeEach(async ({ request }) => {
    await resetPlaidStub();
    await resetYahooStub(request);
  });

  test("stores the holdings and securities Plaid reports", async ({ request }) => {
    // Arrange
    const item = await linkedItem();
    const [aapl, cad] = [uniqueId("sec_aapl"), uniqueId("sec_cad")];
    await setPlaidHoldings(
      answer(
        [item.providerAccountId],
        [holding(item.providerAccountId, aapl, 10, 190.25, 1500), holding(item.providerAccountId, cad, 250, 1, null, "CAD")],
        [apple(aapl), cash(cad)],
      ),
    );

    // Act
    await deliverWebhook(request, holdingsWebhook(item.plaidItemId));

    // Assert
    const stored = await readHoldings(item.itemId);
    expect(stored.map((h) => h.security.tickerSymbol)).toEqual(["AAPL", "CAD"]);
    expect(stored[0]).toMatchObject({ itemId: item.itemId, accountId: item.accountId, isoCurrencyCode: "USD" });
    expect(Number(stored[0]!.quantity)).toBe(10);
    expect(Number(stored[0]!.institutionValue)).toBe(1902.5);
    expect(Number(stored[0]!.costBasis)).toBe(1500);
    expect(stored[1]!.costBasis).toBeNull();
  });

  test("replaces what it stored before, dropping a holding Plaid no longer reports", async ({ request }) => {
    // Arrange: a first update stores two holdings.
    const item = await linkedItem();
    const [aapl, msft] = [uniqueId("sec_aapl"), uniqueId("sec_msft")];
    const securities = [apple(aapl), { ...apple(msft), name: "Microsoft Corp.", ticker_symbol: "MSFT" }];
    await setPlaidHoldings(
      answer([item.providerAccountId], [holding(item.providerAccountId, aapl, 10, 190), holding(item.providerAccountId, msft, 5, 400)], securities),
    );
    await deliverWebhook(request, holdingsWebhook(item.plaidItemId, 2));

    // Act: the user sold the Microsoft shares and bought more Apple.
    await setPlaidHoldings(answer([item.providerAccountId], [holding(item.providerAccountId, aapl, 12, 195)], [apple(aapl)]));
    await deliverWebhook(request, holdingsWebhook(item.plaidItemId, 0));

    // Assert
    const stored = await readHoldings(item.itemId);
    expect(stored.map((h) => h.security.tickerSymbol)).toEqual(["AAPL"]);
    expect(Number(stored[0]!.quantity)).toBe(12);
  });

  test("prices the securities it stores at once: a quote, then two years of history", async ({ request }) => {
    // Arrange: a new security (its ticker is its own, so the stub's price for it is its own).
    const item = await linkedItem();
    const id = uniqueId("sec_new");
    const ticker = uniqueId("").replace(/[^a-f]/g, "").toUpperCase().padEnd(6, "Q").slice(0, 6) + "Z";
    await setPlaidHoldings(answer([item.providerAccountId], [holding(item.providerAccountId, id, 10, 190)], [{ ...apple(id), ticker_symbol: ticker }]));

    // Act
    await deliverWebhook(request, holdingsWebhook(item.plaidItemId));

    // Assert: the pricing runs in the background, so wait for the history, which comes last.
    const [stored] = await readHoldings(item.itemId);
    await expect.poll(async () => (await readSecurityPrices(stored!.securityId)).length, { timeout: 15_000 }).toBeGreaterThan(450);
    const asked = (await yahooRequests(request)).filter((r) => r.symbol === ticker).map((r) => r.kind);
    expect(asked).toEqual(["quote", "history"]);
  });

  test("prices only the securities that have no price yet", async ({ request }) => {
    // Arrange: one security stored and priced by a first update.
    const item = await linkedItem();
    const ticker = () => uniqueId("").replace(/[^a-f]/g, "").toUpperCase().padEnd(6, "Q").slice(0, 6) + "Z";
    const [oldId, newId, oldTicker, newTicker] = [uniqueId("sec_old"), uniqueId("sec_new"), ticker(), ticker()];
    const old = { ...apple(oldId), ticker_symbol: oldTicker };
    await setPlaidHoldings(answer([item.providerAccountId], [holding(item.providerAccountId, oldId, 10, 190)], [old]));
    await deliverWebhook(request, holdingsWebhook(item.plaidItemId));
    const [first] = await readHoldings(item.itemId);
    await expect.poll(async () => (await readSecurityPrices(first!.securityId)).length, { timeout: 15_000 }).toBeGreaterThan(450);
    await resetYahooStub(request);

    // Act: an update adds a second security.
    const added = { ...apple(newId), ticker_symbol: newTicker };
    await setPlaidHoldings(
      answer([item.providerAccountId], [holding(item.providerAccountId, oldId, 10, 190), holding(item.providerAccountId, newId, 5, 50)], [old, added]),
    );
    await deliverWebhook(request, holdingsWebhook(item.plaidItemId, 2));

    // Assert: the new one is priced (history last, so the run is over); the old one was not asked about.
    const second = (await readHoldings(item.itemId)).find((h) => h.security.tickerSymbol === newTicker)!;
    await expect.poll(async () => (await readSecurityPrices(second.securityId)).length, { timeout: 15_000 }).toBeGreaterThan(450);
    const symbols = (await yahooRequests(request)).map((r) => r.symbol);
    expect(symbols).toContain(newTicker);
    expect(symbols).not.toContain(oldTicker);
  });

  test("keeps what it had when Plaid has no investments to give for the item", async ({ request }) => {
    // Arrange
    const item = await linkedItem();
    const aapl = uniqueId("sec_aapl");
    await setPlaidHoldings(answer([item.providerAccountId], [holding(item.providerAccountId, aapl, 10, 190)], [apple(aapl)]));
    await deliverWebhook(request, holdingsWebhook(item.plaidItemId));
    await setPlaidHoldings({ error_code: "PRODUCT_NOT_READY" });

    // Act
    await deliverWebhook(request, holdingsWebhook(item.plaidItemId, 2));

    // Assert: handled (not failed and retried), and the holding is still there.
    expect((await readWebhookEvents(item.plaidItemId)).map((e) => [e.status, e.attempts])).toEqual([
      ["processed", 1],
      ["processed", 1],
    ]);
    expect((await readHoldings(item.itemId)).map((h) => h.security.tickerSymbol)).toEqual(["AAPL"]);
  });

  test("handles a HOLDINGS code it has no action for (processed, nothing stored)", async ({ request }) => {
    // Arrange: Plaid would answer with holdings, if it were asked.
    const item = await linkedItem();
    const aapl = uniqueId("sec_aapl");
    await setPlaidHoldings(answer([item.providerAccountId], [holding(item.providerAccountId, aapl, 10, 190)], [apple(aapl)]));

    // Act
    await deliverWebhook(request, { ...holdingsWebhook(item.plaidItemId), webhook_code: "SOMETHING_NEW" });

    // Assert
    expect(await readHoldings(item.itemId)).toEqual([]);
    expect(await readWebhookEvents(item.plaidItemId)).toMatchObject([{ status: "processed", attempts: 1 }]);
  });
});
