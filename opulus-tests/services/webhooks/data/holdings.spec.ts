import { expect, test } from "@playwright/test";
import { uniqueId } from "../../../shared/client.js";
import { seedLinkedItem, readWebhookEvents, readHoldings, readSecurityPricing, setSecurityPricing } from "../../../shared/fixtures/index.js";
import { resetPlaidStub, setPlaidHoldings } from "../../../shared/plaid-stub.js";
import { answer, apple, cash, holding } from "../../../shared/scenarios/plaid-investments.js";
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
 * - tracks each security with the symbol its price is looked up by, and cash as unpriced
 * - keeps tracking a security once it is sold
 * - follows a ticker Plaid corrects, to be backfilled again, but keeps a symbol set by hand
 * - keeps what it had when Plaid has no investments to give for the item
 * - handles a HOLDINGS code it has no action for (processed, nothing stored)
 */
test.describe("HOLDINGS webhooks", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
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

  test("tracks each security with the symbol its price is looked up by, and cash as unpriced", async ({ request }) => {
    // Arrange: a US stock, a Toronto ETF, and cash.
    const item = await linkedItem();
    const [aapl, veqt, cad] = [uniqueId("sec_aapl"), uniqueId("sec_veqt"), uniqueId("sec_cad")];
    const toronto = { ...apple(veqt), name: "Vanguard All-Equity ETF", ticker_symbol: "VEQT", type: "etf", market_identifier_code: "XTSE", iso_currency_code: "CAD" };
    await setPlaidHoldings(
      answer(
        [item.providerAccountId],
        [holding(item.providerAccountId, aapl, 10, 190), holding(item.providerAccountId, veqt, 5, 60), holding(item.providerAccountId, cad, 250, 1, null, "CAD")],
        [apple(aapl), toronto, cash(cad)],
      ),
    );

    // Act
    await deliverWebhook(request, holdingsWebhook(item.plaidItemId, 3));

    // Assert
    expect(await readSecurityPricing(aapl)).toMatchObject({ priceSymbol: "AAPL", priceStatus: "active", priceSymbolSource: "auto", priceHistoryFrom: null, priceBackfilledAt: null });
    expect(await readSecurityPricing(veqt)).toMatchObject({ priceSymbol: "VEQT.TO", priceStatus: "active" });
    expect(await readSecurityPricing(cad)).toMatchObject({ priceSymbol: null, priceStatus: "unsupported" });
  });

  test("keeps tracking a security once it is sold", async ({ request }) => {
    // Arrange: Apple and Microsoft are held.
    const item = await linkedItem();
    const [aapl, msft] = [uniqueId("sec_aapl"), uniqueId("sec_msft")];
    const securities = [apple(aapl), { ...apple(msft), name: "Microsoft Corp.", ticker_symbol: "MSFT" }];
    await setPlaidHoldings(
      answer([item.providerAccountId], [holding(item.providerAccountId, aapl, 10, 190), holding(item.providerAccountId, msft, 5, 400)], securities),
    );
    await deliverWebhook(request, holdingsWebhook(item.plaidItemId, 2));

    // Act: the Microsoft shares are sold.
    await setPlaidHoldings(answer([item.providerAccountId], [holding(item.providerAccountId, aapl, 10, 190)], [apple(aapl)]));
    await deliverWebhook(request, holdingsWebhook(item.plaidItemId, 0));

    // Assert: no longer held, still tracked.
    expect((await readHoldings(item.itemId)).map((h) => h.security.tickerSymbol)).toEqual(["AAPL"]);
    expect(await readSecurityPricing(msft)).toMatchObject({ priceSymbol: "MSFT", priceStatus: "active" });
  });

  test("follows a ticker Plaid corrects, to be backfilled again, but keeps a symbol set by hand", async ({ request }) => {
    // Arrange: two securities tracked and backfilled; one has its symbol set by hand.
    const item = await linkedItem();
    const [auto, manual] = [uniqueId("sec_auto"), uniqueId("sec_manual")];
    const held = (ticker: string) => [
      { ...apple(auto), ticker_symbol: ticker },
      { ...apple(manual), name: "Microsoft Corp.", ticker_symbol: ticker },
    ];
    const holdings = [holding(item.providerAccountId, auto, 10, 190), holding(item.providerAccountId, manual, 5, 400)];
    await setPlaidHoldings(answer([item.providerAccountId], holdings, held("OLDT")));
    await deliverWebhook(request, holdingsWebhook(item.plaidItemId, 2));
    await setSecurityPricing(auto, { priceBackfilledAt: new Date(), priceHistoryFrom: new Date("2025-01-02") });
    await setSecurityPricing(manual, { priceSymbol: "MSFT", priceSymbolSource: "manual", priceBackfilledAt: new Date() });

    // Act: Plaid corrects the ticker of both.
    await setPlaidHoldings(answer([item.providerAccountId], holdings, held("NEWT")));
    await deliverWebhook(request, holdingsWebhook(item.plaidItemId, 0));

    // Assert: the worked-out symbol follows and is backfilled again; the manual one is kept as it was.
    expect(await readSecurityPricing(auto)).toMatchObject({ priceSymbol: "NEWT", priceHistoryFrom: null, priceBackfilledAt: null });
    expect(await readSecurityPricing(manual)).toMatchObject({ priceSymbol: "MSFT", priceSymbolSource: "manual" });
    expect((await readSecurityPricing(manual))!.priceBackfilledAt).not.toBeNull();
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
