import { expect, test } from "@playwright/test";
import { Prisma, toSpendingByMerchantDTO } from "@opulus/core";

const D = (n: number) => new Prisma.Decimal(n);
type Rows = Parameters<typeof toSpendingByMerchantDTO>[0];

const row = (o: {
  merchant: string | null;
  spent: number;
  category?: string | null;
  currency?: string | null;
  date?: string;
  count?: number;
}): Rows[number] => ({
  merchant: o.merchant,
  category: o.category === undefined ? "FOOD_AND_DRINK" : o.category,
  currency: o.currency === undefined ? "CAD" : o.currency,
  date: o.date ?? "2026-10-01",
  spent: D(o.spent),
  count: o.count ?? 1,
});

const flat = { baseCurrency: "CAD", rateOn: () => 1 };

/**
 * How the repository's merchant rows become the API's spending by merchant
 * (opulus-core/src/types/dto/transactions/getSpendingByMerchant.ts).
 *
 * Test cases:
 * - rows of one merchant are added up, with their transaction count
 * - merchants come largest first, ties by name, unnamed last
 * - each merchant's share is of all spending, and the shares add up to 1
 * - converts each row at its own day's rate for its currency
 * - a merchant's category is the one it spent most in
 * - refunds and zero rows are left out
 * - top lists only that many merchants and adds the rest up in other
 * - no spending gives no merchants, zero spent and no other
 */
test.describe("toSpendingByMerchantDTO", () => {
  test("rows of one merchant are added up, with their transaction count", () => {
    const dto = toSpendingByMerchantDTO(
      [
        row({ merchant: "Starbucks", spent: 5, count: 2 }),
        row({ merchant: "Starbucks", spent: 7.5, date: "2026-10-02" }),
      ],
      flat,
    );
    expect(dto.merchants).toEqual([
      {
        merchant: "Starbucks",
        category: "FOOD_AND_DRINK",
        spent: 12.5,
        count: 3,
        share: 1,
      },
    ]);
    expect(dto.spent).toBe(12.5);
  });

  test("merchants come largest first, ties by name, unnamed last", () => {
    const dto = toSpendingByMerchantDTO(
      [
        row({ merchant: null, spent: 10 }),
        row({ merchant: "B", spent: 10 }),
        row({ merchant: "A", spent: 10 }),
        row({ merchant: "Big", spent: 50 }),
      ],
      flat,
    );
    expect(dto.merchants.map((m) => m.merchant)).toEqual([
      "Big",
      "A",
      "B",
      null,
    ]);
  });

  test("each merchant's share is of all spending, and the shares add up to 1", () => {
    const dto = toSpendingByMerchantDTO(
      [row({ merchant: "A", spent: 75 }), row({ merchant: "B", spent: 25 })],
      flat,
    );
    expect(dto.merchants.map((m) => m.share)).toEqual([0.75, 0.25]);
  });

  test("converts each row at its own day's rate for its currency", () => {
    const dto = toSpendingByMerchantDTO(
      [
        row({ merchant: "A", spent: 10, currency: "USD", date: "2026-10-01" }),
        row({ merchant: "A", spent: 10, currency: "USD", date: "2026-10-02" }),
        row({ merchant: "A", spent: 10, currency: null }),
      ],
      {
        baseCurrency: "CAD",
        rateOn: (currency, day) =>
          currency === "USD" ? (day === "2026-10-01" ? 1.5 : 2) : 1,
      },
    );
    expect(dto.spent).toBe(45);
    expect(dto.merchants[0].spent).toBe(45);
  });

  test("a merchant's category is the one it spent most in", () => {
    const dto = toSpendingByMerchantDTO(
      [
        row({ merchant: "Costco", spent: 30, category: "GENERAL_MERCHANDISE" }),
        row({ merchant: "Costco", spent: 80, category: "FOOD_AND_DRINK" }),
        row({ merchant: "Other", spent: 5, category: null }),
      ],
      flat,
    );
    expect(dto.merchants.map((m) => m.category)).toEqual([
      "FOOD_AND_DRINK",
      null,
    ]);
  });

  test("refunds and zero rows are left out", () => {
    const dto = toSpendingByMerchantDTO(
      [
        row({ merchant: "A", spent: 20 }),
        row({ merchant: "A", spent: -5 }),
        row({ merchant: "B", spent: 0 }),
      ],
      flat,
    );
    expect(dto.merchants).toHaveLength(1);
    expect(dto.spent).toBe(20);
  });

  test("top lists only that many merchants and adds the rest up in other", () => {
    const dto = toSpendingByMerchantDTO(
      [
        row({ merchant: "A", spent: 50, count: 2 }),
        row({ merchant: "B", spent: 30 }),
        row({ merchant: "C", spent: 15, count: 3 }),
        row({ merchant: "D", spent: 5 }),
      ],
      { ...flat, top: 2 },
    );
    expect(dto.merchants.map((m) => m.merchant)).toEqual(["A", "B"]);
    expect(dto.other).toEqual({
      merchants: 2,
      spent: 20,
      count: 4,
      share: 0.2,
    });
  });

  test("no spending gives no merchants, zero spent and no other", () => {
    expect(toSpendingByMerchantDTO([], flat)).toEqual({
      baseCurrency: "CAD",
      spent: 0,
      merchants: [],
      other: null,
    });
  });
});
