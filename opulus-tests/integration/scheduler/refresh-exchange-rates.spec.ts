import { expect, test } from "@playwright/test";
import type { RefreshExchangeRatesResult } from "@opulus/core";
import {
  clearExchangeRates,
  readExchangeRates,
} from "../../shared/fixtures/index.js";
import { runToEnd } from "../../shared/scheduler.js";

const JOB = "refresh-exchange-rates";

/** Today in UTC, as the job counts it. */
const today = () => new Date().toISOString().slice(0, 10);

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * This file: the refresh-exchange-rates job against the REAL Frankfurter API
 * (the ECB's daily rates), through the scheduler. It proves the live provider
 * still answers in the shape our gateway parses and that the job stores what it
 * returns. Rates change daily, so it asserts evidence (what is there, plausible
 * ranges), not exact values. Needs network access, no credentials.
 */
test.describe("refresh-exchange-rates (job, real Frankfurter)", () => {
  test.beforeEach(async () => {
    await clearExchangeRates();
  });

  test("backfills about two years of the ECB's daily rates, the euro at 1", async ({
    request,
  }) => {
    // Act
    const run = await runToEnd(request, JOB, 80_000);

    // Assert: the run completed and reports a real backfill.
    expect(run.state).toBe("completed");
    const result = run.result as RefreshExchangeRatesResult;
    expect(result.to).toBe(today());
    expect(result.days).toBeGreaterThan(400);
    expect(result.created).toBeGreaterThan(result.days * 20);

    // Assert: the table holds a recent weekday and history about two years back.
    const rows = await readExchangeRates();
    const days = [...new Set(rows.map((row) => row.date))];
    expect(days.at(-1)! >= daysAgo(5)).toBe(true);
    expect(days[0]! <= daysAgo(700)).toBe(true);
    expect(rows.every((row) => row.source === "frankfurter")).toBe(true);

    // Assert: the latest day has the euro at exactly 1 and sensible rates for
    // the currencies the app deals in (CAD and USD per euro are both near 1.1 to 1.7).
    const latest = rows.filter((row) => row.date === days.at(-1));
    const perEur = Object.fromEntries(
      latest.map((r) => [r.currency, r.perEur]),
    );
    expect(perEur.EUR).toBe(1);
    for (const currency of ["CAD", "USD"]) {
      expect(perEur[currency]).toBeGreaterThan(0.8);
      expect(perEur[currency]).toBeLessThan(2.2);
    }
    expect(latest.length).toBeGreaterThan(20);
  });

  test("a second run asks only from the latest stored day and adds almost nothing", async ({
    request,
  }) => {
    // Arrange
    await runToEnd(request, JOB, 80_000);
    const latestBefore = (await readExchangeRates()).at(-1)!.date;

    // Act
    const run = await runToEnd(request, JOB, 80_000);

    // Assert: it started where the table left off. (A day the ECB published
    // between the two runs could add one day's rows, so not exactly zero.)
    expect(run.state).toBe("completed");
    const result = run.result as RefreshExchangeRatesResult;
    expect(result.from).toBe(latestBefore);
    expect(result.created).toBeLessThan(60);
  });
});
