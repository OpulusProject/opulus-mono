import { expect, test } from "@playwright/test";
import {
  AccountsSummaryResponseSchema,
  NetWorthHistoryResponseSchema,
} from "@opulus/core";
import { withSession } from "../../../shared/client.js";
import { expectMatchesSchema } from "../../../shared/assertions.js";
import {
  clearExchangeRates,
  createAuthedUser,
  seedExchangeRates,
  seedItemWithAccount,
} from "../../../shared/fixtures/index.js";

/** The day this many days from today, "YYYY-MM-DD" (UTC), as the server counts. */
const day = (offset = 0) =>
  new Date(Date.now() + offset * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

/**
 * This file: the two places net worth is worked out, GET /api/accounts/summary
 * and the last point of GET /api/accounts/net-worth, give the same figure.
 * They share no code (one adds each account once, the other each account on
 * each day), so this is what keeps the dashboard and the accounts pages from
 * disagreeing. exchange_rate is shared by every user, so this file clears and
 * seeds it itself.
 */
test.describe("net worth: history and summary", () => {
  test.beforeAll(async () => {
    // A USD is 1.25 CAD (1.2 USD and 1.5 CAD per euro) on every recent day.
    await clearExchangeRates();
    await seedExchangeRates(
      Array.from({ length: 10 }, (_, i) => day(-i)).flatMap((date) => [
        { date, currency: "EUR", perEur: 1 },
        { date, currency: "CAD", perEur: 1.5 },
        { date, currency: "USD", perEur: 1.2 },
      ]),
    );
  });

  test("today's point equals the summary's net worth, across currencies and what is owed", async ({
    request,
  }) => {
    // Arrange: 1000.55 CAD and 300.25 USD owned, 120.1 CAD and 80.35 USD owed,
    // and an account with no currency (taken as CAD).
    const { cookie, userId } = await createAuthedUser(request);
    for (const account of [
      { balanceCurrent: 1000.55, isoCurrencyCode: "CAD" },
      { balanceCurrent: 300.25, isoCurrencyCode: "USD" },
      { type: "credit", balanceCurrent: 120.1, isoCurrencyCode: "CAD" },
      { type: "loan", balanceCurrent: 80.35, isoCurrencyCode: "USD" },
      { balanceCurrent: 10, isoCurrencyCode: null },
    ]) {
      await seedItemWithAccount(userId, { account });
    }

    // Act
    const headers = withSession(cookie);
    const summary = (
      await expectMatchesSchema(
        await request.get("/api/accounts/summary", { headers }),
        AccountsSummaryResponseSchema,
      )
    ).data;
    const history = (
      await expectMatchesSchema(
        await request.get("/api/accounts/net-worth?range=1w", { headers }),
        NetWorthHistoryResponseSchema,
      )
    ).data;

    // Assert: 1000.55 + 375.3125 + 10 - 120.1 - 100.4375 = 1165.325
    expect(history.baseCurrency).toBe(summary.baseCurrency);
    expect(history.points.at(-1)?.netWorth).toBe(summary.total.netWorth);
    expect(summary.total.netWorth).toBe(1165.325);
  });
});
