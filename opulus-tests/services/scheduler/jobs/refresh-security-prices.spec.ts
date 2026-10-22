import { expect, test } from "@playwright/test";
import { uniqueId } from "../../../shared/client.js";
import { readSecurityPrices, seedSecurity, seedSecurityPrice } from "../../../shared/fixtures/index.js";
import { runToEnd } from "../../../shared/scheduler.js";
import { failYahooStub, resetYahooStub, setYahooPrice, yahooRequests } from "../../../shared/yahoo-stub.js";

const JOB = "refresh-security-prices";

/** A ticker of its own, letters only, so the stub's price for it is its own. */
const ticker = () => uniqueId("").replace(/[^a-f]/g, "").toUpperCase().padEnd(6, "Q").slice(0, 6) + "Z";

/** Today in Toronto (UTC-4, as the stub's quotes are), which is the day a quote is for. */
const tradingDay = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/**
 * A security on its own, on the Toronto exchange (its symbol is the ticker with
 * .TO, in CAD) or with no exchange (USD). Its history counts as fetched, so these
 * tests see only the quotes (the history is the other spec's).
 */
const listed = (symbol: string, mic: string | null = null) =>
  seedSecurity({ plaidSecurityId: uniqueId("sec"), tickerSymbol: symbol, marketIdentifierCode: mic, backfilled: true });

/** The chart requests the stub saw for one symbol. */
const quotesFor = async (request: Parameters<typeof yahooRequests>[0], symbol: string) =>
  (await yahooRequests(request)).filter((r) => r.symbol === symbol && r.kind === "quote");

/**
 * This file: the refresh-security-prices job, run through the scheduler against
 * the Yahoo stub. It checks what the job asked the provider for and what it
 * stored in security_price (read from the test database: a job's work has no
 * other place to be seen). The tables are shared, so each test uses securities
 * of its own and looks only at them.
 *
 * Test cases:
 * - quotes a security and stores the price as today's, with its currency, source and the time of the quote
 * - quotes a security no account holds
 * - replaces today's price with the next quote, and leaves earlier days alone
 * - looks each security up by the symbol worked out from its ticker and exchange
 * - leaves cash unpriced, and does not ask the provider about it
 * - logs a security the provider has no price for, keeps its last price, and still prices the others
 * - asks about a security with no price again on the next run
 * - fails the run, storing nothing, when the provider cannot be reached
 */
test.describe("refresh-security-prices (job)", () => {
  test.beforeEach(async ({ request }) => {
    await resetYahooStub(request);
  });

  test("quotes a security and stores the price as today's, with its currency, source and the time of the quote", async ({ request }) => {
    // Arrange
    const base = ticker();
    const security = await listed(base, "XTSE");
    await setYahooPrice(request, `${base}.TO`, 71.23);
    const before = Date.now();

    // Act
    const run = await runToEnd(request, JOB);

    // Assert
    expect(run.state).toBe("completed");
    const [price] = await readSecurityPrices(security.id);
    expect(price).toMatchObject({ date: tradingDay(), close: 71.23, currency: "CAD", source: "yahoo" });
    expect(price!.asOf.getTime()).toBeGreaterThanOrEqual(before - 5_000);
  });

  test("quotes a security no account holds", async ({ request }) => {
    // Arrange: sold long ago, and the account removed: nothing holds it (this security never had a holding).
    const symbol = ticker();
    const security = await listed(symbol);
    await setYahooPrice(request, symbol, 12.5);

    // Act
    await runToEnd(request, JOB);

    // Assert
    expect((await readSecurityPrices(security.id)).map((p) => [p.close, p.currency])).toEqual([[12.5, "USD"]]);
  });

  test("replaces today's price with the next quote, and leaves earlier days alone", async ({ request }) => {
    // Arrange: an earlier close, and a first quote today.
    const symbol = ticker();
    const security = await listed(symbol);
    await seedSecurityPrice({ securityId: security.id, date: daysAgo(3), close: 40, currency: "USD" });
    await setYahooPrice(request, symbol, 50);
    await runToEnd(request, JOB);

    // Act: the price moves and the job runs again.
    await setYahooPrice(request, symbol, 52.5);
    await runToEnd(request, JOB);

    // Assert: still one row for today, now with the new price.
    const prices = await readSecurityPrices(security.id);
    expect(prices.map((p) => [p.date, p.close])).toEqual([
      [daysAgo(3), 40],
      [tradingDay(), 52.5],
    ]);
  });

  test("looks each security up by the symbol worked out from its ticker and exchange", async ({ request }) => {
    // Arrange: a Toronto ETF, a US stock with a share class, and one that already carries its suffix.
    const [toronto, us, suffixed] = [ticker(), ticker(), ticker()];
    await listed(toronto, "XTSE");
    await listed(`${us}.B`, "XNYS");
    await listed(`${suffixed}.TO`);

    // Act
    await runToEnd(request, JOB);

    // Assert
    const asked = (await yahooRequests(request)).map((r) => r.symbol);
    expect(asked).toEqual(expect.arrayContaining([`${toronto}.TO`, `${us}-B`, `${suffixed}.TO`]));
    expect(asked).not.toContain(toronto);
  });

  test("leaves cash unpriced, and does not ask the provider about it", async ({ request }) => {
    // Arrange
    const cashTicker = ticker();
    const cash = await seedSecurity({ plaidSecurityId: uniqueId("sec"), tickerSymbol: cashTicker, type: "cash", isCashEquivalent: true });

    // Act
    await runToEnd(request, JOB);

    // Assert
    expect(await readSecurityPrices(cash.id)).toEqual([]);
    expect((await yahooRequests(request)).filter((r) => r.symbol.startsWith(cashTicker))).toEqual([]);
  });

  test("logs a security the provider has no price for, keeps its last price, and still prices the others", async ({ request }) => {
    // Arrange: a symbol the stub does not know, with a close from earlier, and a good one.
    const unknown = await listed(`NOPE${ticker()}`);
    await seedSecurityPrice({ securityId: unknown.id, date: daysAgo(2), close: 20, currency: "USD" });
    const goodSymbol = ticker();
    const good = await listed(goodSymbol);
    await setYahooPrice(request, goodSymbol, 33);

    // Act
    const run = await runToEnd(request, JOB);

    // Assert: the run is fine (one bad symbol is not the run's failure); the old price is untouched, the good one stored.
    expect(run.state).toBe("completed");
    expect((await readSecurityPrices(unknown.id)).map((p) => p.close)).toEqual([20]);
    expect((await readSecurityPrices(good.id)).map((p) => p.close)).toEqual([33]);
  });

  test("asks about a security with no price again on the next run", async ({ request }) => {
    // Arrange
    const symbol = `NOPE${ticker()}`;
    await listed(symbol);

    // Act
    await runToEnd(request, JOB);
    await runToEnd(request, JOB);

    // Assert
    expect(await quotesFor(request, symbol)).toHaveLength(2);
  });

  test("fails the run, storing nothing, when the provider cannot be reached", async ({ request }) => {
    // Arrange
    const security = await listed(ticker());
    await failYahooStub(request);

    // Act
    const run = await runToEnd(request, JOB);

    // Assert: failed (and retried by the queue); no price stored.
    expect(run.state).toBe("failed");
    expect(await readSecurityPrices(security.id)).toEqual([]);
  });
});
