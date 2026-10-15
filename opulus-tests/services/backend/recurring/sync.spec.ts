import { expect, test, type APIRequestContext } from "@playwright/test";
import { SyncRecurringResponseSchema } from "@opulus/core";
import { expectMatchesSchema, expectStatus, expectValidationError } from "../../../shared/assertions.js";
import { uniqueId, withSession } from "../../../shared/client.js";
import {
  createAuthedUser,
  readStreams,
  seedItemWithAccount,
  seedStream,
} from "../../../shared/fixtures/index.js";
import {
  recurringRequests,
  resetPlaidStub,
  setPlaidRecurring,
} from "../../../shared/plaid-stub.js";

function sync(request: APIRequestContext, cookie: string, itemId: string) {
  return request.post("/api/recurring-transactions/sync", {
    headers: withSession(cookie),
    data: { itemId },
  });
}

async function setup(request: APIRequestContext) {
  const { cookie, userId } = await createAuthedUser(request);
  const item = await seedItemWithAccount(userId);
  return { cookie, userId, item };
}

/** A stream in Plaid's snake_case. Plaid reports an outflow's amount as positive and an inflow's as negative. */
const stream = (
  accountId: string,
  streamId: string,
  overrides: Record<string, unknown> = {},
) => ({
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

/**
 * This file: syncing an item's recurring payments and income from Plaid
 * (answered by the Plaid stub): what is stored, that a sync replaces what was
 * stored, and what happens when Plaid has nothing to give yet.
 */
test.describe("POST /api/recurring-transactions/sync", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/recurring-transactions/sync", { data: { itemId: "x" } });

    await expectStatus(res, 401);
  });

  test("rejects a missing itemId (validation)", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    const res = await request.post("/api/recurring-transactions/sync", {
      headers: withSession(cookie),
      data: {},
    });

    await expectValidationError(res);
  });

  test("rejects an item that does not exist (404)", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    await expectStatus(await sync(request, cookie, "no-such-item"), 404);
  });

  test("rejects another user's item (401)", async ({ request }) => {
    const owner = await setup(request);
    const { cookie } = await createAuthedUser(request);

    await expectStatus(await sync(request, cookie, owner.item.itemId), 401);
  });

  test("asks Plaid about the item's accounts", async ({ request }) => {
    // Arrange
    const { cookie, item } = await setup(request);

    // Act
    await sync(request, cookie, item.itemId);

    // Assert
    const [asked] = await recurringRequests();
    expect(asked).toMatchObject({ account_ids: [item.providerAccountId] });
  });

  test("stores the inflow and outflow streams, with positive amounts and their direction", async ({
    request,
  }) => {
    // Arrange: a subscription (outflow) and a salary (inflow, which Plaid reports negative).
    const { cookie, item } = await setup(request);
    const [sub, pay] = [uniqueId("stream_sub"), uniqueId("stream_pay")];
    await setPlaidRecurring({
      response: {
        outflow_streams: [stream(item.providerAccountId, sub)],
        inflow_streams: [
          stream(item.providerAccountId, pay, {
            description: "Payroll",
            merchant_name: null,
            frequency: "BIWEEKLY",
            average_amount: { amount: -2100, iso_currency_code: "CAD" },
            last_amount: { amount: -2100, iso_currency_code: "CAD" },
            predicted_next_date: null,
            personal_finance_category: { primary: "INCOME", detailed: "INCOME_WAGES" },
          }),
        ],
      },
    });

    // Act
    const res = await sync(request, cookie, item.itemId);

    // Assert
    const body = await expectMatchesSchema(res, SyncRecurringResponseSchema);
    expect(body.data).toEqual({ status: "synced", streams: 2 });
    const stored = await readStreams(item.itemId);
    expect(stored.map((s) => [s.description, s.direction])).toEqual([
      ["Payroll", "inflow"],
      ["Streaming Service", "outflow"],
    ]);
    const [payroll, streaming] = stored;
    expect(payroll).toMatchObject({ frequency: "BIWEEKLY", status: "MATURE", isActive: true, category: "INCOME", predictedNextDate: null, merchantName: null });
    expect(Number(payroll!.averageAmount)).toBe(2100);
    expect(Number(payroll!.lastAmount)).toBe(2100);
    expect(streaming).toMatchObject({
      accountId: item.accountId,
      merchantName: "StreamCo",
      frequency: "MONTHLY",
      isoCurrencyCode: "CAD",
      category: "ENTERTAINMENT",
    });
    expect(Number(streaming!.averageAmount)).toBe(15.99);
    expect(Number(streaming!.lastAmount)).toBe(16.49);
    expect(streaming!.firstDate.toISOString().slice(0, 10)).toBe("2026-01-15");
    expect(streaming!.predictedNextDate?.toISOString().slice(0, 10)).toBe("2026-10-15");
  });

  test("replaces what was stored: a changed stream updates, one Plaid dropped goes", async ({
    request,
  }) => {
    // Arrange: two stored streams; Plaid now reports one of them, changed.
    const { cookie, userId, item } = await setup(request);
    const [keep, gone] = [uniqueId("stream_keep"), uniqueId("stream_gone")];
    const base = { userId, itemId: item.itemId, accountId: item.accountId };
    await seedStream({ ...base, plaidStreamId: keep, description: "Gym", averageAmount: 40 });
    await seedStream({ ...base, plaidStreamId: gone, description: "Old magazine" });
    await setPlaidRecurring({
      response: {
        inflow_streams: [],
        outflow_streams: [
          stream(item.providerAccountId, keep, {
            description: "Gym",
            average_amount: { amount: 45, iso_currency_code: "CAD" },
            status: "TOMBSTONED",
            is_active: false,
          }),
        ],
      },
    });

    // Act
    await sync(request, cookie, item.itemId);

    // Assert: updated in place (same row, new amount and status), the other removed.
    const stored = await readStreams(item.itemId);
    expect(stored.map((s) => s.description)).toEqual(["Gym"]);
    expect(Number(stored[0]!.averageAmount)).toBe(45);
    expect(stored[0]).toMatchObject({ status: "TOMBSTONED", isActive: false });
  });

  test("an item with no recurring transactions ends up with none stored", async ({
    request,
  }) => {
    const { cookie, userId, item } = await setup(request);
    await seedStream({ userId, itemId: item.itemId, accountId: item.accountId });

    const res = await sync(request, cookie, item.itemId);

    const body = await expectMatchesSchema(res, SyncRecurringResponseSchema);
    expect(body.data).toEqual({ status: "synced", streams: 0 });
    expect(await readStreams(item.itemId)).toEqual([]);
  });

  test("leaves what is stored alone while Plaid has nothing to give yet (unavailable)", async ({
    request,
  }) => {
    // Arrange: Plaid says the item's transactions are not ready.
    const { cookie, userId, item } = await setup(request);
    await seedStream({ userId, itemId: item.itemId, accountId: item.accountId });
    await setPlaidRecurring({ error_code: "PRODUCT_NOT_READY" });

    // Act
    const res = await sync(request, cookie, item.itemId);

    // Assert
    const body = await expectMatchesSchema(res, SyncRecurringResponseSchema);
    expect(body.data).toEqual({ status: "unavailable", reason: "PRODUCT_NOT_READY" });
    expect(await readStreams(item.itemId)).toHaveLength(1);
  });

  test("ignores a stream in an account that is not the item's", async ({ request }) => {
    const { cookie, item } = await setup(request);
    await setPlaidRecurring({
      response: {
        inflow_streams: [],
        outflow_streams: [stream("someone-elses-account", uniqueId("stream"))],
      },
    });

    const res = await sync(request, cookie, item.itemId);

    const body = await expectMatchesSchema(res, SyncRecurringResponseSchema);
    expect(body.data).toEqual({ status: "synced", streams: 0 });
    expect(await readStreams(item.itemId)).toEqual([]);
  });
});
