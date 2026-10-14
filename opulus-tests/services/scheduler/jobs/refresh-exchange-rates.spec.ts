import { expect, test } from "@playwright/test";
import type { RefreshExchangeRatesResult } from "@opulus/core";
import {
  clearExchangeRates,
  deleteExchangeRatesFrom,
  readExchangeRates,
} from "../../../shared/fixtures/index.js";
import {
  failStub,
  resetStub,
  stubRequests,
} from "../helpers/frankfurterStub.js";
import { runToEnd } from "../../../shared/scheduler.js";
import {
  STUB_CURRENCIES,
  addDays,
  lastPublishingDay,
  publishingDays,
  stubRatesFor,
} from "../stub/rates.mjs";

const JOB = "refresh-exchange-rates";

/** Today in UTC, as the job counts it. */
const today = () => new Date().toISOString().slice(0, 10);

/** The days the table holds a rate for, oldest first. */
const storedDays = (rows: { date: string }[]) => [
  ...new Set(rows.map((row) => row.date)),
];

/**
 * This file: the refresh-exchange-rates job, run through the scheduler against
 * the Frankfurter stub. It checks what the job asked the provider for and what
 * it stored in exchange_rate (read from the test database: a job's work has no
 * other place to be seen). The table is shared, so each test clears it first.
 */
test.describe("refresh-exchange-rates (job)", () => {
  test.beforeEach(async ({ request }) => {
    await clearExchangeRates();
    await resetStub(request);
  });

  test("backfills about two years of daily rates into an empty table, the euro included", async ({
    request,
  }) => {
    // Act
    const run = await runToEnd(request, JOB);

    // Assert: one request, for two years up to today.
    expect(run.state).toBe("completed");
    const from = addDays(today(), -730);
    expect(await stubRequests(request)).toEqual([
      { from, to: today(), base: "EUR" },
    ]);

    // Every publishing day in that range, each with every currency and the euro.
    const expectedDays = publishingDays(from, today());
    const rows = await readExchangeRates();
    expect(storedDays(rows)).toEqual(expectedDays);
    expect(rows).toHaveLength(
      expectedDays.length * (STUB_CURRENCIES.length + 1),
    );
    expect(run.result as RefreshExchangeRatesResult).toEqual({
      from,
      to: today(),
      days: expectedDays.length,
      created: rows.length,
    });
  });

  test("stores each day's rates as the provider published them, against the euro", async ({
    request,
  }) => {
    // Act
    await runToEnd(request, JOB);

    // Assert: the latest day, and the first, exactly as the stub published them.
    const rows = await readExchangeRates();
    for (const day of [lastPublishingDay(today()), rows[0]!.date]) {
      const stored = rows.filter((row) => row.date === day);
      expect(stored).toEqual(
        [
          ...Object.entries(stubRatesFor(day)).map(([currency, perEur]) => ({
            date: day,
            currency,
            perEur,
            source: "frankfurter",
          })),
          { date: day, currency: "EUR", perEur: 1, source: "frankfurter" },
        ].sort((a, b) => a.currency.localeCompare(b.currency)),
      );
    }
  });

  test("a second run asks only from the latest stored day and adds nothing already stored", async ({
    request,
  }) => {
    // Arrange: a full table.
    await runToEnd(request, JOB);
    const before = await readExchangeRates();
    await resetStub(request);

    // Act
    const run = await runToEnd(request, JOB);

    // Assert
    const latest = lastPublishingDay(today());
    expect(await stubRequests(request)).toEqual([
      { from: latest, to: today(), base: "EUR" },
    ]);
    expect((run.result as RefreshExchangeRatesResult).created).toBe(0);
    expect(await readExchangeRates()).toEqual(before);
  });

  test("catches up the days missed since the latest stored day", async ({
    request,
  }) => {
    // Arrange: a full table, then the last week removed, as if those runs never happened.
    await runToEnd(request, JOB);
    const full = await readExchangeRates();
    const removed = await deleteExchangeRatesFrom(addDays(today(), -7));
    const remaining = storedDays(await readExchangeRates());
    await resetStub(request);

    // Act
    const run = await runToEnd(request, JOB);

    // Assert: asked from the latest remaining day, and the week is back.
    expect(await stubRequests(request)).toEqual([
      { from: remaining.at(-1)!, to: today(), base: "EUR" },
    ]);
    expect((run.result as RefreshExchangeRatesResult).created).toBe(removed);
    expect(await readExchangeRates()).toEqual(full);
  });

  test("fails after its retries when the provider is down, and stores nothing", async ({
    request,
  }) => {
    // Arrange
    await failStub(request);

    // Act
    const run = await runToEnd(request, JOB);

    // Assert: three attempts, each one asking the provider, and an empty table.
    expect(run.state).toBe("failed");
    expect(run.attempts).toBe(3);
    expect(run.error).toBe("Frankfurter answered 503");
    expect(await stubRequests(request)).toHaveLength(3);
    expect(await readExchangeRates()).toEqual([]);
  });
});
