import { expect, test } from "@playwright/test";
import { uniqueId } from "../../../shared/client.js";
import { testDb } from "../../../shared/db.js";
import { readSecurityDividends, seedSecurity } from "../../../shared/fixtures/index.js";
import { runToEnd } from "../../../shared/scheduler.js";
import { failYahooStub, resetYahooStub, setYahooDividends, yahooRequests } from "../../../shared/yahoo-stub.js";

const JOB = "refresh-security-dividends";

/** A ticker of its own, letters only. */
const ticker = () => uniqueId("").replace(/[^a-f]/g, "").toUpperCase().padEnd(6, "Q").slice(0, 6) + "Z";

const listed = (symbol: string, mic: string | null = null, extra: { type?: string; isCashEquivalent?: boolean } = {}) =>
  seedSecurity({ plaidSecurityId: uniqueId("sec"), tickerSymbol: symbol, marketIdentifierCode: mic, backfilled: true, ...extra });

/** The quote summary requests the stub saw for one symbol. */
const askedFor = async (request: Parameters<typeof yahooRequests>[0], symbol: string) =>
  (await yahooRequests(request)).filter((r) => r.symbol === symbol && r.kind === "dividends");

/**
 * This file: the refresh-security-dividends job, run through the scheduler
 * against the Yahoo stub. It checks what the job asked the provider for and what
 * it stored on the security (read from the test database). The security table
 * is shared, so each test uses securities of its own and looks only at them.
 *
 * Test cases:
 * - stores a stock's annual rate, yield and currency, and when they were fetched
 * - works a fund's rate out from its yield and price when Yahoo gives no rate
 * - stores a rate of 0 for a security that pays nothing
 * - looks each security up by the symbol worked out from its ticker and exchange
 * - leaves cash alone, and does not ask the provider about it
 * - logs a security the provider has no figure for, keeps what it had, and still updates the others
 * - fails the run, storing nothing, when the provider cannot be reached
 */
test.describe("refresh-security-dividends (job)", () => {
  test.beforeEach(async ({ request }) => {
    await resetYahooStub(request);
  });

  test("stores a stock's annual rate, yield and currency, and when they were fetched", async ({ request }) => {
    // Arrange
    const base = ticker();
    const security = await listed(base, "XTSE");
    await setYahooDividends(request, `${base}.TO`, { dividendRate: 4.48 });
    const before = Date.now();

    // Act
    const run = await runToEnd(request, JOB);

    // Assert
    expect(run.state).toBe("completed");
    const stored = await readSecurityDividends(security.id);
    expect(stored).toMatchObject({ rate: 4.48, currency: "CAD" });
    expect(stored.yield).toBeGreaterThan(0);
    expect(stored.fetchedAt!.getTime()).toBeGreaterThanOrEqual(before - 5_000);
  });

  test("works a fund's rate out from its yield and price when Yahoo gives no rate", async ({ request }) => {
    // Arrange: only a yield of 2%, on a price the stub also knows.
    const symbol = ticker();
    const security = await listed(symbol);
    await setYahooDividends(request, symbol, { yield: 0.02 });

    // Act
    await runToEnd(request, JOB);

    // Assert: 2% of the stub's price (50 plus its letters, mod 100).
    const price = 50 + ([...symbol].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 100);
    const stored = await readSecurityDividends(security.id);
    expect(stored.rate).toBeCloseTo(price * 0.02, 4);
    expect(stored).toMatchObject({ yield: 0.02, currency: "USD" });
  });

  test("stores a rate of 0 for a security that pays nothing", async ({ request }) => {
    // Arrange
    const symbol = ticker();
    const security = await listed(symbol);
    await setYahooDividends(request, symbol, { yield: 0 });

    // Act
    await runToEnd(request, JOB);

    // Assert
    expect(await readSecurityDividends(security.id)).toMatchObject({ rate: 0, yield: 0 });
  });

  test("looks each security up by the symbol worked out from its ticker and exchange", async ({ request }) => {
    // Arrange
    const base = ticker();
    await listed(base, "XTSE");

    // Act
    await runToEnd(request, JOB);

    // Assert
    expect(await askedFor(request, `${base}.TO`)).toHaveLength(1);
    expect(await askedFor(request, base)).toHaveLength(0);
  });

  test("leaves cash alone, and does not ask the provider about it", async ({ request }) => {
    // Arrange
    const symbol = ticker();
    const cash = await listed(symbol, null, { type: "cash", isCashEquivalent: true });

    // Act
    await runToEnd(request, JOB);

    // Assert
    expect(await askedFor(request, symbol)).toHaveLength(0);
    expect(await readSecurityDividends(cash.id)).toMatchObject({ rate: null, currency: null, fetchedAt: null });
  });

  test("logs a security the provider has no figure for, keeps what it had, and still updates the others", async ({ request }) => {
    // Arrange: one the stub does not know, with a rate from an earlier run, and a good one.
    const unknown = await listed("NOPE" + ticker());
    const good = ticker();
    const known = await listed(good);
    await setYahooDividends(request, good, { dividendRate: 1.5 });
    await testDb().security.update({ where: { id: unknown.id }, data: { dividendRate: 2, dividendCurrency: "USD" } });

    // Act
    const run = await runToEnd(request, JOB);

    // Assert
    expect(run.state).toBe("completed");
    expect(await readSecurityDividends(unknown.id)).toMatchObject({ rate: 2, currency: "USD", fetchedAt: null });
    expect((await readSecurityDividends(known.id)).rate).toBe(1.5);
  });

  test("fails the run, storing nothing, when the provider cannot be reached", async ({ request }) => {
    // Arrange
    const symbol = ticker();
    const security = await listed(symbol);
    await failYahooStub(request);

    // Act
    const run = await runToEnd(request, JOB);

    // Assert
    expect(run.state).toBe("failed");
    expect(await readSecurityDividends(security.id)).toMatchObject({ rate: null, fetchedAt: null });
  });
});
