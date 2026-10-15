import { expect, test } from "@playwright/test";
import { expectStatus } from "../../../shared/assertions.js";
import {
  clearExchangeRates,
  seedExchangeRates,
} from "../../../shared/fixtures/index.js";

/** The day this many days ago, "YYYY-MM-DD" (UTC). */
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Seed a rate for the given day, the only one stored. */
async function onlyRateOn(date: string) {
  await clearExchangeRates();
  await seedExchangeRates([{ date, currency: "EUR", perEur: 1 }]);
}

/**
 * This file: the readiness check reports whether the exchange rates are being
 * kept up to date, because a missing rate is an error for any amount in another
 * currency, and a scheduler that has stopped should show up here first. It is
 * information: the backend stays ready either way. This file clears and seeds
 * exchange_rate, a table every user shares.
 */
test.describe("GET /ready", () => {
  test("is ready, with the database connected", async ({ request }) => {
    const res = await request.get("/ready");

    await expectStatus(res, 200);
    expect(await res.json()).toMatchObject({ status: "ready", database: "connected" });
  });

  test("says the exchange rates are fresh when the newest is recent", async ({
    request,
  }) => {
    // Arrange: a rate from three days ago, as on a Monday after a Friday.
    await onlyRateOn(daysAgo(3));

    // Act
    const body = await (await request.get("/ready")).json();

    // Assert
    expect(body.exchangeRates).toEqual({ status: "fresh", latestDate: daysAgo(3) });
  });

  test("says they are stale when the newest is more than five days old, and stays ready", async ({
    request,
  }) => {
    // Arrange
    await onlyRateOn(daysAgo(9));

    // Act
    const res = await request.get("/ready");

    // Assert: reported, but not a failure.
    await expectStatus(res, 200);
    const body = await res.json();
    expect(body.status).toBe("ready");
    expect(body.exchangeRates).toEqual({ status: "stale", latestDate: daysAgo(9) });
  });

  test("says they are empty when none are stored, and stays ready", async ({
    request,
  }) => {
    // Arrange
    await clearExchangeRates();

    // Act
    const res = await request.get("/ready");

    // Assert
    await expectStatus(res, 200);
    expect((await res.json()).exchangeRates).toEqual({ status: "empty", latestDate: null });
  });

  test("five days old is still fresh, six is stale", async ({ request }) => {
    await onlyRateOn(daysAgo(5));
    expect((await (await request.get("/ready")).json()).exchangeRates.status).toBe("fresh");

    await onlyRateOn(daysAgo(6));
    expect((await (await request.get("/ready")).json()).exchangeRates.status).toBe("stale");
  });
});
