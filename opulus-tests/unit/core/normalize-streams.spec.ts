import { expect, test } from "@playwright/test";
import { normalizePlaidStreams } from "@opulus/core";

type Response = Parameters<typeof normalizePlaidStreams>[0];
const plaid = (value: unknown) => value as Response;

const stream = {
  account_id: "acct",
  stream_id: "stream-1",
  description: "Streaming Service",
  merchant_name: "StreamCo",
  first_date: "2026-01-15",
  last_date: "2026-09-15",
  predicted_next_date: "2026-10-15",
  frequency: "MONTHLY",
  status: "MATURE",
  is_active: true,
  average_amount: { amount: 15.99, iso_currency_code: "CAD" },
  last_amount: { amount: 16.49, iso_currency_code: "CAD" },
  personal_finance_category: { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_TV_AND_MOVIES" },
};

/**
 * Plaid's recurring streams as we keep them (opulus-core/src/repositories/recurringStreamRepository.ts):
 * the direction is a column of its own, so amounts are stored positive either way.
 *
 * Test cases:
 * - keeps a stream's description, merchant, pace, status, dates, amounts, currency and category
 * - an outflow is an outflow and an inflow an inflow, and both amounts are positive whichever sign Plaid sent
 * - turns what Plaid left out into null, and a missing amount into zero
 * - lists inflows first, then outflows, and nothing for none
 */
test.describe("normalizePlaidStreams", () => {
  test("keeps a stream's description, merchant, pace, status, dates, amounts, currency and category", () => {
    const [row] = normalizePlaidStreams(plaid({ inflow_streams: [], outflow_streams: [stream] }));

    expect(row).toEqual({
      providerAccountId: "acct",
      plaidStreamId: "stream-1",
      data: {
        direction: "outflow",
        description: "Streaming Service",
        merchantName: "StreamCo",
        frequency: "MONTHLY",
        status: "MATURE",
        isActive: true,
        firstDate: new Date("2026-01-15"),
        lastDate: new Date("2026-09-15"),
        predictedNextDate: new Date("2026-10-15"),
        averageAmount: 15.99,
        lastAmount: 16.49,
        isoCurrencyCode: "CAD",
        category: "ENTERTAINMENT",
      },
    });
  });

  test("an outflow is an outflow and an inflow an inflow, and both amounts are positive whichever sign Plaid sent", () => {
    const salary = { ...stream, stream_id: "salary", average_amount: { amount: -2100, iso_currency_code: "CAD" }, last_amount: { amount: -2100, iso_currency_code: "CAD" } };
    const rows = normalizePlaidStreams(plaid({ inflow_streams: [salary], outflow_streams: [{ ...stream, average_amount: { amount: -15.99 } }] }));

    expect(rows.map((r) => [r.plaidStreamId, r.data.direction, r.data.averageAmount, r.data.lastAmount])).toEqual([
      ["salary", "inflow", 2100, 2100],
      ["stream-1", "outflow", 15.99, 16.49],
    ]);
  });

  test("turns what Plaid left out into null, and a missing amount into zero", () => {
    const [row] = normalizePlaidStreams(
      plaid({
        inflow_streams: [],
        outflow_streams: [
          {
            ...stream,
            merchant_name: null,
            predicted_next_date: null,
            personal_finance_category: null,
            average_amount: { amount: null },
            last_amount: {},
          },
        ],
      }),
    );

    expect(row!.data).toMatchObject({ merchantName: null, predictedNextDate: null, category: null, averageAmount: 0, lastAmount: 0, isoCurrencyCode: null });
  });

  test("lists inflows first, then outflows, and nothing for none", () => {
    const rows = normalizePlaidStreams(plaid({ inflow_streams: [{ ...stream, stream_id: "in" }], outflow_streams: [{ ...stream, stream_id: "out" }] }));

    expect(rows.map((r) => r.plaidStreamId)).toEqual(["in", "out"]);
    expect(normalizePlaidStreams(plaid({ inflow_streams: [], outflow_streams: [] }))).toEqual([]);
  });
});
