import { expect, test } from "@playwright/test";
import { AppError, exchangeRateRepository, loadExchangeRateConverter, Prisma } from "@opulus/core";

type Rate = { date: string; currency: string; perEur: number };
const stored = (rows: Rate[]) =>
  rows.map((r) => ({ ...r, perEur: new Prisma.Decimal(r.perEur) })).sort((a, b) => a.date.localeCompare(b.date));

/**
 * Put these rates "in the table" for one test: the converter reads them through
 * the repository, which is replaced here so no database is needed. Returns how
 * many reads were made.
 */
function storeRates(rows: Rate[]) {
  const reads = { inRange: 0, earliest: 0 };
  exchangeRateRepository.getForCurrencies = async ({ currencies, from, to }) => {
    reads.inRange += 1;
    return stored(rows.filter((r) => currencies.includes(r.currency) && r.date >= from && r.date <= to));
  };
  exchangeRateRepository.getEarliestForCurrencies = async (currencies) => {
    reads.earliest += 1;
    const earliest = new Map<string, Rate>();
    for (const r of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
      if (currencies.includes(r.currency) && !earliest.has(r.currency)) earliest.set(r.currency, r);
    }
    return stored([...earliest.values()]);
  };
  return reads;
}

const original = {
  getForCurrencies: exchangeRateRepository.getForCurrencies,
  getEarliestForCurrencies: exchangeRateRepository.getEarliestForCurrencies,
};

/**
 * Converting amounts to the base currency (opulus-core/src/services/exchangeRateConverter.ts).
 * Rates are stored per euro, so X in CAD is perEur(CAD) / perEur(X) on that day.
 *
 * Test cases:
 * - the base currency, and an amount with no currency, is worth 1
 * - converts through the euro on the day asked for
 * - uses the latest rate on or before a day, so a weekend takes Friday's
 * - uses the earliest stored rate for a day older than the history
 * - reads the table twice however many days and currencies, and not at all when nothing is foreign
 * - says so when a currency has no rate stored at all
 */
test.describe("exchange rate converter", () => {
  test.afterEach(() => {
    Object.assign(exchangeRateRepository, original);
  });

  test("the base currency, and an amount with no currency, is worth 1", async () => {
    storeRates([]);
    const converter = await loadExchangeRateConverter({ baseCurrency: "CAD", currencies: ["CAD", null], days: ["2026-10-14"] });

    expect(converter.rateOn("CAD", "2026-10-14")).toBe(1);
    expect(converter.rateOn(null, "2026-10-14")).toBe(1);
  });

  test("converts through the euro on the day asked for", async () => {
    storeRates([
      { date: "2026-10-14", currency: "CAD", perEur: 1.5 },
      { date: "2026-10-14", currency: "USD", perEur: 1.2 },
      { date: "2026-10-15", currency: "CAD", perEur: 1.6 },
      { date: "2026-10-15", currency: "USD", perEur: 1.2 },
    ]);
    const converter = await loadExchangeRateConverter({
      baseCurrency: "CAD",
      currencies: ["USD", "EUR"],
      days: ["2026-10-14", "2026-10-15"],
    });

    // 1 USD = 1.5 / 1.2 CAD on the 14th, 1.6 / 1.2 on the 15th.
    expect(converter.rateOn("USD", "2026-10-14")).toBeCloseTo(1.25, 10);
    expect(converter.rateOn("USD", "2026-10-15")).toBeCloseTo(1.6 / 1.2, 10);
  });

  test("uses the latest rate on or before a day, so a weekend takes Friday's", async () => {
    storeRates([
      { date: "2026-10-09", currency: "CAD", perEur: 1.4 },
      { date: "2026-10-09", currency: "USD", perEur: 1.0 },
      { date: "2026-10-12", currency: "CAD", perEur: 1.5 },
      { date: "2026-10-12", currency: "USD", perEur: 1.0 },
    ]);
    const converter = await loadExchangeRateConverter({
      baseCurrency: "CAD",
      currencies: ["USD"],
      days: ["2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12"],
    });

    expect([converter.rateOn("USD", "2026-10-10"), converter.rateOn("USD", "2026-10-11")]).toEqual([1.4, 1.4]);
    expect(converter.rateOn("USD", "2026-10-12")).toBe(1.5);
  });

  test("uses the earliest stored rate for a day older than the history", async () => {
    storeRates([
      { date: "2026-10-12", currency: "CAD", perEur: 1.5 },
      { date: "2026-10-12", currency: "USD", perEur: 1.0 },
    ]);
    const converter = await loadExchangeRateConverter({
      baseCurrency: "CAD",
      currencies: ["USD"],
      days: ["2026-09-01", "2026-10-12"],
    });

    expect(converter.rateOn("USD", "2026-09-01")).toBe(1.5);
  });

  test("reads the table twice however many days and currencies, and not at all when nothing is foreign", async () => {
    const reads = storeRates([
      { date: "2026-10-12", currency: "CAD", perEur: 1.5 },
      { date: "2026-10-12", currency: "USD", perEur: 1.0 },
      { date: "2026-10-12", currency: "GBP", perEur: 0.8 },
    ]);
    const days = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);

    await loadExchangeRateConverter({ baseCurrency: "CAD", currencies: ["USD", "GBP", "USD"], days });
    expect(reads).toEqual({ inRange: 1, earliest: 1 });

    await loadExchangeRateConverter({ baseCurrency: "CAD", currencies: ["CAD", null], days });
    await loadExchangeRateConverter({ baseCurrency: "CAD", currencies: ["USD"], days: [] });
    expect(reads).toEqual({ inRange: 1, earliest: 1 });
  });

  test("says so when a currency has no rate stored at all", async () => {
    storeRates([{ date: "2026-10-12", currency: "CAD", perEur: 1.5 }]);
    const converter = await loadExchangeRateConverter({ baseCurrency: "CAD", currencies: ["JPY"], days: ["2026-10-12"] });

    expect(() => converter.rateOn("JPY", "2026-10-12")).toThrow(AppError);
    expect(() => converter.rateOn("JPY", "2026-10-12")).toThrow("No exchange rate stored for JPY");
  });
});
