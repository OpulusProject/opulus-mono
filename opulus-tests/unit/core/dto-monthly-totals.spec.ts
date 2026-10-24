import { expect, test } from "@playwright/test";
import { Prisma, toMonthlyTransactionTotalsDTO } from "@opulus/core";

const D = (n: number) => new Prisma.Decimal(n);
type Totals = Parameters<typeof toMonthlyTransactionTotalsDTO>[0];

const day = (
  date: string,
  spent: number,
  currency: string | null = "CAD",
): Totals["byDay"][number] => ({
  currency,
  date: new Date(`${date}T00:00:00Z`),
  spent: D(spent),
});

const rates: Record<string, number> = {
  "USD|2026-09-30": 1.5,
  "USD|2026-10-01": 1.25,
};
const options = {
  baseCurrency: "CAD",
  rateOn: (currency: string | null, date: string) =>
    currency === null || currency === "CAD"
      ? 1
      : (rates[`${currency}|${date}`] ?? 1),
};

test.describe("toMonthlyTransactionTotalsDTO", () => {
  test("adds days up by month, oldest first", () => {
    const dto = toMonthlyTransactionTotalsDTO(
      {
        byDay: [
          day("2026-10-05", 10),
          day("2026-09-01", 5.5),
          day("2026-10-20", 2.25),
          day("2026-09-30", 4),
        ],
      },
      options,
    );
    expect(dto).toEqual({
      baseCurrency: "CAD",
      byMonth: [
        { month: "2026-09", spent: 9.5 },
        { month: "2026-10", spent: 12.25 },
      ],
    });
  });

  test("converts each day at its own rate, even across a month boundary", () => {
    const dto = toMonthlyTransactionTotalsDTO(
      {
        byDay: [
          day("2026-09-30", 100, "USD"),
          day("2026-10-01", 100, "USD"),
          day("2026-10-01", 10),
        ],
      },
      options,
    );
    expect(dto.byMonth).toEqual([
      { month: "2026-09", spent: 150 },
      { month: "2026-10", spent: 135 },
    ]);
  });

  test("takes an amount with no currency as is", () => {
    const dto = toMonthlyTransactionTotalsDTO(
      { byDay: [day("2026-10-02", 7, null)] },
      options,
    );
    expect(dto.byMonth).toEqual([{ month: "2026-10", spent: 7 }]);
  });

  test("rounds once to four decimals", () => {
    const dto = toMonthlyTransactionTotalsDTO(
      { byDay: [day("2026-10-01", 0.33333, "USD")] },
      options,
    );
    expect(dto.byMonth).toEqual([{ month: "2026-10", spent: 0.4167 }]);
  });

  test("returns no months when nothing was spent", () => {
    expect(toMonthlyTransactionTotalsDTO({ byDay: [] }, options)).toEqual({
      baseCurrency: "CAD",
      byMonth: [],
    });
  });
});
