import { expect, test } from "@playwright/test";
import { RecurringResponseSchema } from "@opulus/core";
import { expectMatchesSchema, expectValidationError } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import {
  clearExchangeRates,
  createAuthedUser,
  seedExchangeRates,
  seedItemWithAccount,
  seedStream,
} from "../../../shared/fixtures/index.js";

/** The day this many days from today, "YYYY-MM-DD" (UTC). */
const day = (offset = 0) =>
  new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

async function setup(request: Parameters<typeof createAuthedUser>[0]) {
  const { cookie, userId } = await createAuthedUser(request);
  const item = await seedItemWithAccount(userId, {
    institutionName: "Maple Bank",
    accountName: "Chequing",
  });
  return { cookie, userId, item, base: { userId, itemId: item.itemId, accountId: item.accountId } };
}

async function getRecurring(
  request: Parameters<typeof createAuthedUser>[0],
  cookie: string,
  query = "",
) {
  const res = await request.get(`/api/recurring-transactions${query}`, {
    headers: withSession(cookie),
  });
  return (await expectMatchesSchema(res, RecurringResponseSchema)).data;
}

/**
 * This file: the recurring transactions endpoint: each stream with what it comes
 * to a month in CAD (so a weekly payment and an annual one can be compared), and
 * what the active ones add up to. Exchange rates are seeded (1 USD = 1.25 CAD)
 * because this file clears and seeds the shared table itself.
 */
test.describe("GET /api/recurring-transactions", () => {
  test.beforeAll(async () => {
    await clearExchangeRates();
    await seedExchangeRates(
      Array.from({ length: 5 }, (_, i) => day(-i)).flatMap((date) => [
        { date, currency: "EUR", perEur: 1 },
        { date, currency: "CAD", perEur: 1.5 },
        { date, currency: "USD", perEur: 1.2 },
      ]),
    );
  });

  test("gives nothing for a user with none", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    const data = await getRecurring(request, cookie);

    expect(data).toEqual({
      baseCurrency: "CAD",
      summary: { monthlyOutflow: 0, monthlyInflow: 0, streamsWithoutFrequency: 0 },
      streams: [],
    });
  });

  test("gives a stream's details with its account and institution", async ({ request }) => {
    // Arrange
    const { cookie, base, item } = await setup(request);
    await seedStream({
      ...base,
      description: "Streaming Service",
      merchantName: "StreamCo",
      frequency: "MONTHLY",
      averageAmount: 15.99,
      lastAmount: 16.49,
      category: "ENTERTAINMENT",
      predictedNextDate: new Date("2026-10-15T00:00:00Z"),
    });

    // Act
    const { streams } = await getRecurring(request, cookie);

    // Assert
    expect(streams).toHaveLength(1);
    expect(streams[0]).toMatchObject({
      accountId: item.accountId,
      accountName: "Chequing",
      institutionName: "Maple Bank",
      direction: "outflow",
      description: "Streaming Service",
      merchantName: "StreamCo",
      frequency: "MONTHLY",
      status: "MATURE",
      isActive: true,
      averageAmount: 15.99,
      lastAmount: 16.49,
      currency: "CAD",
      category: "ENTERTAINMENT",
      predictedNextDate: "2026-10-15T00:00:00.000Z",
      monthlyAmountInBase: 15.99,
    });
  });

  test("works out a monthly amount for each frequency so they can be compared", async ({
    request,
  }) => {
    // Arrange: 120 CAD at each pace.
    const { cookie, base } = await setup(request);
    for (const frequency of ["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY", "ANNUALLY"]) {
      await seedStream({ ...base, description: frequency, frequency, averageAmount: 120 });
    }

    // Act
    const { streams } = await getRecurring(request, cookie);

    // Assert: 120 x 52 / 12, x 26 / 12, x 24 / 12, x 12 / 12, x 1 / 12.
    const monthly = Object.fromEntries(streams.map((s) => [s.description, s.monthlyAmountInBase]));
    expect(monthly).toEqual({
      WEEKLY: 520,
      BIWEEKLY: 260,
      SEMI_MONTHLY: 240,
      MONTHLY: 120,
      ANNUALLY: 10,
    });
    // Biggest monthly amount first.
    expect(streams.map((s) => s.description)).toEqual([
      "WEEKLY",
      "BIWEEKLY",
      "SEMI_MONTHLY",
      "MONTHLY",
      "ANNUALLY",
    ]);
  });

  test("converts another currency to CAD at today's rate", async ({ request }) => {
    const { cookie, base } = await setup(request);
    await seedStream({ ...base, description: "US service", frequency: "MONTHLY", averageAmount: 40, currency: "USD" });

    const { streams } = await getRecurring(request, cookie);

    expect(streams[0]).toMatchObject({ averageAmount: 40, currency: "USD", monthlyAmountInBase: 50 });
  });

  test("adds the active streams up by direction, and counts the ones with no known frequency", async ({
    request,
  }) => {
    // Arrange: 100 + 20 a month out, 2000 a month in, one with an unknown pace.
    const { cookie, base } = await setup(request);
    await seedStream({ ...base, description: "Rent", direction: "outflow", frequency: "MONTHLY", averageAmount: 100 });
    await seedStream({ ...base, description: "Gym", direction: "outflow", frequency: "MONTHLY", averageAmount: 20 });
    await seedStream({ ...base, description: "Salary", direction: "inflow", frequency: "MONTHLY", averageAmount: 2000 });
    await seedStream({ ...base, description: "Odd one", direction: "outflow", frequency: "UNKNOWN", averageAmount: 33 });

    // Act
    const { summary, streams } = await getRecurring(request, cookie);

    // Assert
    expect(summary).toEqual({ monthlyOutflow: 120, monthlyInflow: 2000, streamsWithoutFrequency: 1 });
    expect(streams.find((s) => s.description === "Odd one")?.monthlyAmountInBase).toBeNull();
    // Streams with no monthly amount go last.
    expect(streams.at(-1)?.description).toBe("Odd one");
  });

  test("leaves out streams that have stopped, unless includeInactive, and the summary never counts them", async ({
    request,
  }) => {
    // Arrange
    const { cookie, base } = await setup(request);
    await seedStream({ ...base, description: "Active", averageAmount: 10 });
    await seedStream({ ...base, description: "Cancelled", averageAmount: 99, isActive: false, status: "TOMBSTONED" });

    // Act
    const byDefault = await getRecurring(request, cookie);
    const withInactive = await getRecurring(request, cookie, "?includeInactive=true");

    // Assert
    expect(byDefault.streams.map((s) => s.description)).toEqual(["Active"]);
    expect(withInactive.streams.map((s) => s.description).sort()).toEqual(["Active", "Cancelled"]);
    expect(withInactive.summary.monthlyOutflow).toBe(10);
  });

  test("filters by direction", async ({ request }) => {
    const { cookie, base } = await setup(request);
    await seedStream({ ...base, description: "Out", direction: "outflow" });
    await seedStream({ ...base, description: "In", direction: "inflow" });

    const outflow = await getRecurring(request, cookie, "?direction=outflow");
    const inflow = await getRecurring(request, cookie, "?direction=inflow");

    expect(outflow.streams.map((s) => s.description)).toEqual(["Out"]);
    expect(inflow.streams.map((s) => s.description)).toEqual(["In"]);
  });

  test("contains only the requesting user's streams", async ({ request }) => {
    const owner = await setup(request);
    await seedStream({ ...owner.base, description: "Mine" });
    const { cookie } = await createAuthedUser(request);

    const data = await getRecurring(request, cookie);

    expect(data.streams).toEqual([]);
  });

  test("rejects an unknown direction or includeInactive value (validation)", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);

    for (const query of ["?direction=sideways", "?includeInactive=maybe"]) {
      const res = await request.get(`/api/recurring-transactions${query}`, {
        headers: withSession(cookie),
      });
      await expectValidationError(res);
    }
  });
});
