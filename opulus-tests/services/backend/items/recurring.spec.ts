import { expect, test, type APIRequestContext } from "@playwright/test";
import { RecurringResponseSchema } from "@opulus/core";
import { expectMatchesSchema, expectStatus } from "../../../shared/assertions.js";
import { uniqueId, withSession } from "../../../shared/client.js";
import {
  clearExchangeRates,
  createAuthedUser,
  seedExchangeRates,
} from "../../../shared/fixtures/index.js";
import { payroll, stream } from "../../../shared/scenarios/plaid-recurring.js";
import { recurringRequests, resetPlaidStub, setPlaidRecurring, type Plaid, type TransactionStream } from "../../../shared/plaid-stub.js";
import { linkInstitution, plaidAccount, updateItemAccounts } from "../../../shared/scenarios/plaid.js";

/** The day this many days from today, "YYYY-MM-DD" (UTC). */
const day = (offset = 0) =>
  new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Link a bank with these (chequing) accounts; recurring transactions are synced as part of linking. Returns the item's id. */
async function link(request: APIRequestContext, cookie: string, accountIds: string[]) {
  const { itemId } = await linkInstitution(request, cookie, { accounts: accountIds.map((id) => plaidAccount(id)) });
  return itemId;
}

const updateAccounts = updateItemAccounts;

/** What the user sees: their recurring streams, including the stopped ones. */
async function shown(request: APIRequestContext, cookie: string) {
  const res = await request.get("/api/recurring-transactions?includeInactive=true", {
    headers: withSession(cookie),
  });
  const { streams } = (await expectMatchesSchema(res, RecurringResponseSchema)).data;
  return streams.sort((a, b) => a.description.localeCompare(b.description));
}

/** A stream in Plaid's snake_case. Plaid reports an outflow's amount as positive and an inflow's as negative. */
const stream = (
  accountId: string,
  streamId: string,
  overrides: Plaid<TransactionStream> = {},
): Plaid<TransactionStream> => ({
  account_id: accountId,
  stream_id: streamId,
  description: "Streaming Service",
  merchant_name: "StreamCo",
  first_date: "2026-01-15",
  last_date: "2026-09-15",
  predicted_next_date: "2026-10-15",
  frequency: "MONTHLY",
  average_amount: { amount: 15.99, iso_currency_code: "CAD" },
  last_amount: { amount: 16.49, iso_currency_code: "CAD" },
  is_active: true,
  status: "MATURE",
  personal_finance_category: { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_TV_AND_MOVIES" },
  ...overrides,
});

const payroll = (accountId: string, streamId: string) =>
  stream(accountId, streamId, {
    description: "Payroll",
    merchant_name: null,
    frequency: "BIWEEKLY",
    average_amount: { amount: -2100, iso_currency_code: "CAD" },
    last_amount: { amount: -2100, iso_currency_code: "CAD" },
    predicted_next_date: null,
    personal_finance_category: { primary: "INCOME", detailed: "INCOME_WAGES" },
  });

/**
 * This file: what a user's recurring payments and income look like after the
 * backend syncs them, which it does when an institution is linked and again when
 * its accounts are updated (answered by the Plaid stub), seen through
 * GET /api/recurring-transactions. A sync replaces what was stored, and an
 * institution with nothing to give yet never fails linking or updating. Exchange
 * rates are seeded because the endpoint converts to the base currency.
 */
test.describe("recurring transactions synced by linking and updating (Plaid stub)", () => {
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

  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("asks Plaid about the item's accounts when an institution is linked", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");

    // Act
    await link(request, cookie, [account]);

    // Assert
    const [asked] = await recurringRequests();
    expect(asked).toMatchObject({ account_ids: [account] });
  });

  test("stores the inflow and outflow streams Plaid reports, with positive amounts and their direction", async ({
    request,
  }) => {
    // Arrange: a subscription (outflow) and a salary (inflow, which Plaid reports negative).
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    await setPlaidRecurring({
      response: {
        outflow_streams: [stream(account, uniqueId("stream_sub"))],
        inflow_streams: [payroll(account, uniqueId("stream_pay"))],
      },
    });

    // Act
    await link(request, cookie, [account]);

    // Assert
    const [pay, subscription] = await shown(request, cookie);
    expect(pay).toMatchObject({
      description: "Payroll",
      direction: "inflow",
      merchantName: null,
      frequency: "BIWEEKLY",
      status: "MATURE",
      isActive: true,
      category: "INCOME",
      predictedNextDate: null,
      averageAmount: 2100,
      lastAmount: 2100,
      currency: "CAD",
    });
    expect(subscription).toMatchObject({
      description: "Streaming Service",
      direction: "outflow",
      merchantName: "StreamCo",
      frequency: "MONTHLY",
      accountName: `Chequing ${account}`,
      institutionName: "Stub Bank",
      currency: "CAD",
      category: "ENTERTAINMENT",
      averageAmount: 15.99,
      lastAmount: 16.49,
    });
    expect(subscription!.firstDate.slice(0, 10)).toBe("2026-01-15");
    expect(subscription!.predictedNextDate?.slice(0, 10)).toBe("2026-10-15");
  });

  test("links an institution whose recurring transactions are not ready, with none stored", async ({
    request,
  }) => {
    // Arrange: Plaid says the item's transactions are not loaded yet.
    const { cookie } = await createAuthedUser(request);
    await setPlaidRecurring({ error_code: "PRODUCT_NOT_READY" });

    // Act: linking still succeeds.
    await link(request, cookie, [uniqueId("acct")]);

    // Assert
    expect(await shown(request, cookie)).toEqual([]);
  });

  test("ignores a stream in an account that is not the item's", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    await setPlaidRecurring({
      response: {
        inflow_streams: [],
        outflow_streams: [
          stream(account, uniqueId("stream_mine"), { description: "Mine" }),
          stream("someone-elses-account", uniqueId("stream_theirs"), { description: "Theirs" }),
        ],
      },
    });

    // Act
    await link(request, cookie, [account]);

    // Assert
    expect((await shown(request, cookie)).map((s) => s.description)).toEqual(["Mine"]);
  });

  test("replaces what was stored when its accounts are updated: a changed stream updates, one Plaid dropped goes", async ({
    request,
  }) => {
    // Arrange: two linked streams; Plaid then reports one of them, changed.
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    const [keep, gone] = [uniqueId("stream_keep"), uniqueId("stream_gone")];
    await setPlaidRecurring({
      response: {
        inflow_streams: [],
        outflow_streams: [
          stream(account, keep, { description: "Gym", average_amount: { amount: 40, iso_currency_code: "CAD" } }),
          stream(account, gone, { description: "Old magazine" }),
        ],
      },
    });
    const itemId = await link(request, cookie, [account]);
    const [beforeGym] = (await shown(request, cookie)).filter((s) => s.description === "Gym");
    await setPlaidRecurring({
      response: {
        inflow_streams: [],
        outflow_streams: [
          stream(account, keep, {
            description: "Gym",
            average_amount: { amount: 45, iso_currency_code: "CAD" },
            status: "TOMBSTONED",
            is_active: false,
          }),
        ],
      },
    });

    // Act
    await expectStatus(await updateAccounts(request, cookie, itemId), 200);

    // Assert: updated in place (same row, new amount and status), the other removed.
    const after = await shown(request, cookie);
    expect(after.map((s) => s.description)).toEqual(["Gym"]);
    expect(after[0]).toMatchObject({ id: beforeGym!.id, averageAmount: 45, status: "TOMBSTONED", isActive: false });
  });

  test("an update where Plaid reports none removes what was stored", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    await setPlaidRecurring({
      response: { inflow_streams: [], outflow_streams: [stream(account, uniqueId("stream"))] },
    });
    const itemId = await link(request, cookie, [account]);
    await setPlaidRecurring({ response: { inflow_streams: [], outflow_streams: [] } });

    // Act
    await updateAccounts(request, cookie, itemId);

    // Assert
    expect(await shown(request, cookie)).toEqual([]);
  });

  test("leaves what is stored alone when Plaid can no longer give it (unavailable)", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    await setPlaidRecurring({
      response: { inflow_streams: [], outflow_streams: [stream(account, uniqueId("stream"))] },
    });
    const itemId = await link(request, cookie, [account]);
    await setPlaidRecurring({ error_code: "PRODUCT_NOT_READY" });

    // Act: the update still succeeds.
    await expectStatus(await updateAccounts(request, cookie, itemId), 200);

    // Assert
    expect(await shown(request, cookie)).toHaveLength(1);
  });
});
