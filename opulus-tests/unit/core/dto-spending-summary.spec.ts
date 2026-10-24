import { expect, test } from "@playwright/test";
import { Prisma, toSpendingSummaryDTO } from "@opulus/core";

const D = (n: number) => new Prisma.Decimal(n);
type Totals = Parameters<typeof toSpendingSummaryDTO>[0];

const spent = (date: string, amount: number, currency: string | null = "CAD") =>
  ({
    currency,
    date: new Date(`${date}T00:00:00Z`),
    spent: D(amount),
    income: D(0),
  }) as Totals["byDay"][number];

const flat = { baseCurrency: "CAD", rateOn: () => 1 };

test.describe("toSpendingSummaryDTO", () => {
  test("compares the month so far with the same days of the last month", () => {
    const dto = toSpendingSummaryDTO(
      {
        byDay: [
          spent("2026-09-03", 100),
          spent("2026-09-10", 50), // day 10 counts
          spent("2026-09-11", 25), // not in the same days
          spent("2026-10-02", 90),
          spent("2026-10-10", 60),
          spent("2026-10-20", 999), // after today
        ],
      },
      { ...flat, month: "2026-10", today: "2026-10-10" }
    );
    expect(dto).toEqual({
      baseCurrency: "CAD",
      month: "2026-10",
      daysElapsed: 10,
      daysInMonth: 31,
      spentSoFar: 150,
      lastMonthSameDays: 150,
      changePercent: 0,
      dailyAverage: 15,
      projectedMonthEnd: 465,
      lastMonthTotal: 175,
    });
  });

  test("change percent is rounded to one decimal and can be negative", () => {
    const dto = toSpendingSummaryDTO(
      { byDay: [spent("2026-09-01", 300), spent("2026-10-01", 200)] },
      { ...flat, month: "2026-10", today: "2026-10-05" }
    );
    expect(dto.changePercent).toBe(-33.3);
  });

  test("change percent is null when last month had nothing in the same days", () => {
    const dto = toSpendingSummaryDTO(
      { byDay: [spent("2026-09-20", 80), spent("2026-10-02", 40)] },
      { ...flat, month: "2026-10", today: "2026-10-05" }
    );
    expect(dto.changePercent).toBeNull();
    expect(dto.lastMonthSameDays).toBe(0);
    expect(dto.lastMonthTotal).toBe(80);
  });

  test("a shorter last month counts all of its days", () => {
    const dto = toSpendingSummaryDTO(
      { byDay: [spent("2026-02-28", 70), spent("2026-03-30", 140)] },
      { ...flat, month: "2026-03", today: "2026-03-30" }
    );
    expect(dto.lastMonthSameDays).toBe(70);
    expect(dto.lastMonthTotal).toBe(70);
    expect(dto.changePercent).toBe(100);
    expect(dto.dailyAverage).toBeCloseTo(4.6667, 4);
    expect(dto.projectedMonthEnd).toBeCloseTo(144.6667, 4);
  });

  test("a past month counts in full and projects to what was spent", () => {
    const dto = toSpendingSummaryDTO(
      { byDay: [spent("2026-08-31", 31), spent("2026-09-15", 30)] },
      { ...flat, month: "2026-09", today: "2026-10-24" }
    );
    expect(dto.daysElapsed).toBe(30);
    expect(dto.spentSoFar).toBe(30);
    expect(dto.projectedMonthEnd).toBe(30);
    expect(dto.lastMonthTotal).toBe(31);
  });

  test("the previous month of January is December", () => {
    const dto = toSpendingSummaryDTO(
      { byDay: [spent("2025-12-05", 40), spent("2026-01-05", 20)] },
      { ...flat, month: "2026-01", today: "2026-01-10" }
    );
    expect(dto.lastMonthTotal).toBe(40);
    expect(dto.spentSoFar).toBe(20);
  });

  test("converts each day at its own rate and adds currencies together", () => {
    const dto = toSpendingSummaryDTO(
      {
        byDay: [
          spent("2026-10-01", 10, "USD"),
          spent("2026-10-01", 5, "CAD"),
          spent("2026-10-02", 10, "USD"),
        ],
      },
      {
        baseCurrency: "CAD",
        rateOn: (currency, day) =>
          currency === "USD" ? (day === "2026-10-01" ? 1.25 : 1.5) : 1,
        month: "2026-10",
        today: "2026-10-02",
      }
    );
    expect(dto.spentSoFar).toBe(32.5);
    expect(dto.dailyAverage).toBe(16.25);
  });

  test("a month with nothing yet is all zeros", () => {
    const dto = toSpendingSummaryDTO(
      { byDay: [] },
      { ...flat, month: "2026-10", today: "2026-10-01" }
    );
    expect(dto).toMatchObject({
      spentSoFar: 0,
      changePercent: null,
      dailyAverage: 0,
      projectedMonthEnd: 0,
      lastMonthTotal: 0,
    });
  });
});
