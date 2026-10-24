import { expect, test } from "@playwright/test";
import {
  Prisma,
  SPENDING_HABIT_RULE,
  isHabitFlagged,
  toSpendingHabitsDTO,
  type CategorySpend,
  type HabitTransaction,
} from "@opulus/core";

const D = (n: number) => new Prisma.Decimal(n);
const flat = { baseCurrency: "CAD", rateOn: () => 1 };

let nextId = 0;
const txn = (o: {
  amount: number;
  category?: string | null;
  detailed?: string | null;
  currency?: string | null;
  date?: string;
  name?: string;
}): HabitTransaction => ({
  id: `t${++nextId}`,
  name: o.name ?? "Shop",
  currency: o.currency === undefined ? "CAD" : o.currency,
  category: o.category === undefined ? "FOOD_AND_DRINK" : o.category,
  categoryDetailed: o.detailed ?? null,
  date: o.date ?? "2026-10-05",
  amount: D(o.amount),
});

const past = (spent: number, category = "FOOD_AND_DRINK"): CategorySpend[] => [
  { currency: "CAD", category, date: "2026-09-04", spent: D(spent), count: 1 },
];

test.describe("isHabitFlagged", () => {
  test("needs both the ratio and the amount over the usual", () => {
    expect(SPENDING_HABIT_RULE).toMatchObject({
      months: 3,
      minIncreaseRatio: 0.2,
      minIncrease: 50,
    });
    expect(isHabitFlagged(250, 200)).toBe(true); // +$50, +25%
    expect(isHabitFlagged(249, 200)).toBe(false); // +$49
    expect(isHabitFlagged(1049, 1000)).toBe(false); // +$49, +4.9%
    expect(isHabitFlagged(1100, 1000)).toBe(false); // +$100 but only +10%
    expect(isHabitFlagged(1200, 1000)).toBe(true); // +$200, +20%
  });

  test("a category with no usual flags on the amount alone", () => {
    expect(isHabitFlagged(50, 0)).toBe(true);
    expect(isHabitFlagged(49, 0)).toBe(false);
  });
});

test.describe("toSpendingHabitsDTO", () => {
  test("compares this month with the average of the months before", () => {
    const data = toSpendingHabitsDTO(
      {
        current: [75, 75, 75, 75].map((amount) => txn({ amount })),
        previous: [past(100), past(200), past(300)],
      },
      flat,
    );

    expect(data.baseCurrency).toBe("CAD");
    expect(data.monthsCompared).toBe(3);
    expect(data.categories).toHaveLength(1);
    expect(data.categories[0]).toMatchObject({
      category: "FOOD_AND_DRINK",
      spent: 300,
      usual: 200,
      change: 100,
      changeRatio: 0.5,
      flagged: true,
      tag: "habit",
    });
  });

  test("a single large transaction makes it a one-off", () => {
    const data = toSpendingHabitsDTO(
      {
        current: [
          txn({ amount: 20 }),
          txn({ amount: 20 }),
          txn({ amount: 400, name: "Wedding gift" }),
        ],
        previous: [past(100), past(100), past(100)],
      },
      flat,
    );

    expect(data.categories[0]).toMatchObject({
      flagged: true,
      tag: "one-off",
      largestTransaction: { name: "Wedding gift", spent: 400 },
    });
  });

  test("names the top detailed category", () => {
    const data = toSpendingHabitsDTO(
      {
        current: [
          txn({ amount: 100, detailed: "FOOD_AND_DRINK_COFFEE" }),
          txn({ amount: 60, detailed: "FOOD_AND_DRINK_RESTAURANT" }),
          txn({ amount: 60, detailed: "FOOD_AND_DRINK_RESTAURANT" }),
          txn({ amount: 10, detailed: null }),
        ],
        previous: [past(100)],
      },
      flat,
    );

    expect(data.categories[0]!.topDetailedCategory).toEqual({
      category: "FOOD_AND_DRINK_RESTAURANT",
      spent: 120,
    });
  });

  test("averages only the months that had spending", () => {
    const data = toSpendingHabitsDTO(
      { current: [txn({ amount: 100 })], previous: [past(40), [], []] },
      flat,
    );

    expect(data.monthsCompared).toBe(1);
    expect(data.categories[0]).toMatchObject({ usual: 40, change: 60 });
  });

  test("with no history nothing is compared or flagged", () => {
    const data = toSpendingHabitsDTO(
      { current: [txn({ amount: 500 })], previous: [[], [], []] },
      flat,
    );

    expect(data.monthsCompared).toBe(0);
    expect(data.categories[0]).toMatchObject({
      spent: 500,
      usual: null,
      change: null,
      changeRatio: null,
      flagged: false,
      tag: null,
    });
  });

  test("a category with usual spending but none yet is listed, unflagged", () => {
    const data = toSpendingHabitsDTO(
      { current: [], previous: [past(80, "TRAVEL")] },
      flat,
    );

    expect(data.categories).toEqual([
      expect.objectContaining({
        category: "TRAVEL",
        spent: 0,
        usual: 80,
        change: -80,
        flagged: false,
        largestTransaction: null,
        topDetailedCategory: null,
      }),
    ]);
  });

  test("a new category over the amount is flagged with no ratio", () => {
    const data = toSpendingHabitsDTO(
      {
        current: [txn({ amount: 75, category: "TRAVEL" })],
        previous: [past(10)],
      },
      flat,
    );

    const travel = data.categories.find((c) => c.category === "TRAVEL")!;
    expect(travel).toMatchObject({
      usual: 0,
      changeRatio: null,
      flagged: true,
    });
  });

  test("converts each transaction at its day's rate", () => {
    const data = toSpendingHabitsDTO(
      {
        current: [txn({ amount: 100, currency: "USD", date: "2026-10-05" })],
        previous: [
          [
            {
              currency: "USD",
              category: "FOOD_AND_DRINK",
              date: "2026-09-04",
              spent: D(50),
              count: 1,
            },
          ],
        ],
      },
      { baseCurrency: "CAD", rateOn: (c) => (c === "USD" ? 1.5 : 1) },
    );

    expect(data.categories[0]).toMatchObject({ spent: 150, usual: 75 });
  });

  test("flagged categories come first, biggest increase first", () => {
    const data = toSpendingHabitsDTO(
      {
        current: [
          txn({ amount: 900, category: "A_BIG" }),
          txn({ amount: 200, category: "B_FLAG" }),
          txn({ amount: 100, category: "C_MID" }),
        ],
        previous: [
          [
            ...past(850, "A_BIG"),
            ...past(100, "B_FLAG"),
            ...past(100, "C_MID"),
          ],
        ],
      },
      flat,
    );

    expect(data.categories.map((c) => [c.category, c.flagged])).toEqual([
      ["B_FLAG", true],
      ["A_BIG", false],
      ["C_MID", false],
    ]);
  });
});
