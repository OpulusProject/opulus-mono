import { expect, test } from "@playwright/test";
import { Prisma, toRecurringDTO } from "@opulus/core";

const D = (n: number) => new Prisma.Decimal(n);
type Rows = Parameters<typeof toRecurringDTO>[0];

let nextId = 0;
const row = (o: {
  amount: number;
  frequency: string;
  direction?: "inflow" | "outflow";
  active?: boolean;
  currency?: string | null;
  description?: string;
  id?: string;
}): Rows[number] =>
  ({
    id: o.id ?? `s${++nextId}`,
    accountId: "acct-1",
    plaidStreamId: "stream",
    direction: o.direction ?? "outflow",
    description: o.description ?? "Stream",
    merchantName: null,
    frequency: o.frequency,
    status: "MATURE",
    isActive: o.active ?? true,
    firstDate: new Date("2026-01-01T00:00:00Z"),
    lastDate: new Date("2026-09-01T00:00:00Z"),
    predictedNextDate: null,
    averageAmount: D(o.amount),
    lastAmount: D(o.amount),
    isoCurrencyCode: o.currency === undefined ? "CAD" : o.currency,
    category: null,
    account: { name: "Chequing" },
    item: { institutionName: "Stub Bank" },
  }) as unknown as Rows[number];

const flat = { baseCurrency: "CAD", rateOn: () => 1 };

/**
 * How stored recurring streams become the API's streams and summary
 * (opulus-core/src/types/dto/recurring/getRecurring.ts): each stream's amount at
 * its pace, converted to the base currency, as a month.
 *
 * Test cases:
 * - a stream's monthly amount is its average amount times its payments a year, over twelve
 * - converts to the base currency at the rate given for the stream's currency
 * - the summary adds up active streams only, inflow and outflow apart
 * - a stream with an unknown frequency has no monthly amount, and is counted as without a frequency while it is active
 * - streams come biggest monthly first, the unknown last, ties by description then id
 * - an empty list gives a zero summary
 */
test.describe("recurring DTO", () => {
  test("a stream's monthly amount is its average amount times its payments a year, over twelve", () => {
    const monthly = (frequency: string) =>
      toRecurringDTO([row({ amount: 120, frequency })], flat).streams[0]!.monthlyAmountInBase;

    expect(monthly("MONTHLY")).toBe(120);
    expect(monthly("ANNUALLY")).toBe(10);
    expect(monthly("WEEKLY")).toBe(520);
    expect(monthly("BIWEEKLY")).toBe(260);
    expect(monthly("SEMI_MONTHLY")).toBe(240);
  });

  test("converts to the base currency at the rate given for the stream's currency", () => {
    const { streams } = toRecurringDTO([row({ amount: 100, frequency: "MONTHLY", currency: "USD" })], {
      baseCurrency: "CAD",
      rateOn: (currency) => (currency === "USD" ? 1.25 : 1),
    });

    expect(streams[0]).toMatchObject({ averageAmount: 100, currency: "USD", monthlyAmountInBase: 125 });
  });

  test("the summary adds up active streams only, inflow and outflow apart", () => {
    const { summary } = toRecurringDTO(
      [
        row({ amount: 15.99, frequency: "MONTHLY" }),
        row({ amount: 2000, frequency: "BIWEEKLY", direction: "inflow" }),
        row({ amount: 50, frequency: "MONTHLY", active: false }),
        row({ amount: 900, frequency: "MONTHLY", direction: "inflow", active: false }),
      ],
      flat,
    );

    expect(summary.monthlyOutflow).toBe(15.99);
    expect(summary.monthlyInflow).toBeCloseTo((2000 * 26) / 12, 3);
  });

  test("a stream with an unknown frequency has no monthly amount, and is counted as without a frequency while it is active", () => {
    const { streams, summary } = toRecurringDTO(
      [row({ amount: 40, frequency: "UNKNOWN" }), row({ amount: 40, frequency: "UNKNOWN", active: false }), row({ amount: 10, frequency: "MONTHLY" })],
      flat,
    );

    expect(streams.filter((s) => s.frequency === "UNKNOWN").map((s) => s.monthlyAmountInBase)).toEqual([null, null]);
    expect(summary).toEqual({ monthlyOutflow: 10, monthlyInflow: 0, streamsWithoutFrequency: 1 });
  });

  test("streams come biggest monthly first, the unknown last, ties by description then id", () => {
    const { streams } = toRecurringDTO(
      [
        row({ id: "1", amount: 10, frequency: "MONTHLY", description: "B" }),
        row({ id: "2", amount: 10, frequency: "MONTHLY", description: "A" }),
        row({ id: "3", amount: 10, frequency: "MONTHLY", description: "A" }),
        row({ id: "4", amount: 99, frequency: "UNKNOWN", description: "Z" }),
        row({ id: "5", amount: 500, frequency: "MONTHLY", description: "Rent" }),
      ],
      flat,
    );

    expect(streams.map((s) => s.id)).toEqual(["5", "2", "3", "1", "4"]);
  });

  test("an empty list gives a zero summary", () => {
    expect(toRecurringDTO([], flat)).toEqual({
      baseCurrency: "CAD",
      summary: { monthlyOutflow: 0, monthlyInflow: 0, streamsWithoutFrequency: 0 },
      streams: [],
    });
  });
});
