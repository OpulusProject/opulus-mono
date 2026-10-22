import { expect, test } from "@playwright/test";
import { uniqueId } from "../../../shared/client.js";
import { readBackfilledAt, readSecurityPrices, seedSecurity, seedSecurityPrice } from "../../../shared/fixtures/index.js";
import { runToEnd } from "../../../shared/scheduler.js";
import { failYahooStub, resetYahooStub, yahooRequests } from "../../../shared/yahoo-stub.js";

const JOB = "refresh-security-prices";

/** A ticker of its own, letters only. */
const ticker = () => uniqueId("").replace(/[^a-f]/g, "").toUpperCase().padEnd(6, "Q").slice(0, 6) + "Z";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/** A security on its own, on the Toronto exchange (so its symbol is the ticker with .TO, in CAD), whose history has not been fetched. */
const waiting = (symbol: string, overrides: Partial<Parameters<typeof seedSecurity>[0]> = {}) =>
  seedSecurity({ plaidSecurityId: uniqueId("sec"), tickerSymbol: symbol, marketIdentifierCode: "XTSE", ...overrides });

/** The history requests the stub saw for one symbol. */
const historyFor = async (request: Parameters<typeof yahooRequests>[0], symbol: string) =>
  (await yahooRequests(request)).filter((r) => r.symbol === symbol && r.kind === "history");

/**
 * This file: the history step of the refresh-security-prices job (it fetches the
 * history of any security that has none after quoting), run through the
 * scheduler against the Yahoo stub. It checks what the job asked the provider
 * for and what it stored in security_price and on the security (read from the
 * test database). The tables are shared, so each test uses securities of its own.
 *
 * Test cases:
 * - fetches about two years of daily closes for a security, and records that its history was fetched
 * - leaves a day that is already stored as it is
 * - leaves a security whose history was already fetched alone
 * - records a security the provider has no history for as done, stores nothing, and does not ask again or hold up the others
 * - fails the run when the provider cannot be reached, leaving the security for the next run
 */
test.describe("refresh-security-prices (job): history", () => {
  test.beforeEach(async ({ request }) => {
    await resetYahooStub(request);
  });

  test("fetches about two years of daily closes for a security, and records that its history was fetched", async ({ request }) => {
    // Arrange
    const base = ticker();
    const security = await waiting(base);

    // Act
    const run = await runToEnd(request, JOB);

    // Assert: one request for the two years up to the end of today.
    expect(run.state).toBe("completed");
    const symbol = `${base}.TO`;
    const [asked] = await historyFor(request, symbol);
    expect(await historyFor(request, symbol)).toHaveLength(1);
    expect(asked!.period1).toBe(Date.parse(`${daysAgo(730)}T00:00:00Z`) / 1000);
    expect(asked!.period2).toBe(Date.parse(`${today()}T00:00:00Z`) / 1000 + 86_400);

    // Weekdays only, oldest first, in the currency the provider gave.
    const prices = await readSecurityPrices(security.id);
    expect(prices.length).toBeGreaterThan(450);
    expect(prices.length).toBeLessThan(530);
    expect(prices.map((p) => p.date)).toEqual([...prices.map((p) => p.date)].sort());
    expect(prices.every((p) => ![0, 6].includes(new Date(`${p.date}T00:00:00Z`).getUTCDay()))).toBe(true);
    expect(prices[0]).toMatchObject({ currency: "CAD", source: "yahoo" });
    expect(await readBackfilledAt(security.id)).not.toBeNull();
  });

  test("leaves a day that is already stored as it is", async ({ request }) => {
    // Arrange: a close for a recent weekday, such as a quote the refresh job stored.
    const security = await waiting(ticker());
    const stored = [1, 2, 3, 4, 5].map(daysAgo).find((day) => ![0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay()))!;
    await seedSecurityPrice({ securityId: security.id, date: stored, close: 999, currency: "CAD" });

    // Act
    await runToEnd(request, JOB);

    // Assert
    const prices = await readSecurityPrices(security.id);
    expect(prices.find((p) => p.date === stored)).toMatchObject({ close: 999, source: "seed" });
    expect(prices.length).toBeGreaterThan(450);
  });

  test("leaves a security whose history was already fetched alone", async ({ request }) => {
    // Arrange
    const base = ticker();
    const security = await waiting(base, { backfilled: true });

    // Act
    await runToEnd(request, JOB);

    // Assert: no history is asked for or stored; the quote step still stores today's price.
    expect(await historyFor(request, `${base}.TO`)).toEqual([]);
    expect(await readSecurityPrices(security.id)).toHaveLength(1);
  });

  test("records a security the provider has no history for as done, stores nothing, and does not ask again or hold up the others", async ({ request }) => {
    // Arrange: one the stub does not know, and a good one stored after it.
    const unknownBase = `NOPE${ticker()}`;
    const unknown = await waiting(unknownBase);
    const good = await waiting(ticker());

    // Act
    const first = await runToEnd(request, JOB);
    const second = await runToEnd(request, JOB);

    // Assert: the run is fine; the unknown one is done with nothing stored and was asked about once; the good one has its history.
    expect(first.state).toBe("completed");
    expect(await readSecurityPrices(unknown.id)).toEqual([]);
    expect(await readBackfilledAt(unknown.id)).not.toBeNull();
    expect(await historyFor(request, `${unknownBase}.TO`)).toHaveLength(1);
    expect((await readSecurityPrices(good.id)).length).toBeGreaterThan(450);
    expect(second.state).toBe("completed");
  });

  test("fails the run when the provider cannot be reached, leaving the security for the next run", async ({ request }) => {
    // Arrange
    const security = await waiting(ticker());
    await failYahooStub(request);

    // Act
    const run = await runToEnd(request, JOB);

    // Assert
    expect(run.state).toBe("failed");
    expect(await readBackfilledAt(security.id)).toBeNull();
    expect(await readSecurityPrices(security.id)).toEqual([]);
  });
});
