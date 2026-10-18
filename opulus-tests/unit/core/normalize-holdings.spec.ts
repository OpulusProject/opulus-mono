import { expect, test } from "@playwright/test";
import { normalizePlaidHoldings } from "@opulus/core";

type Response = Parameters<typeof normalizePlaidHoldings>[0];
const plaid = (value: unknown) => value as Response;

const security = { security_id: "sec-1", name: "Apple Inc.", ticker_symbol: "AAPL", type: "equity", is_cash_equivalent: false, iso_currency_code: "USD", close_price: 189.5, close_price_as_of: "2026-10-14" };
const holding = { account_id: "acct", security_id: "sec-1", quantity: 10, institution_price: 190.25, institution_price_as_of: "2026-10-14", institution_value: 1902.5, cost_basis: 1500, iso_currency_code: "USD" };

/**
 * Plaid's holdings as we keep them (opulus-core/src/repositories/holdingRepository.ts):
 * only what the API shows, and no holding in a security Plaid did not describe.
 *
 * Test cases:
 * - keeps a security's name, ticker, type, currency and close price, with dates as dates
 * - keeps a holding's quantity, price, value and cost basis, keyed by Plaid's account and security ids
 * - turns what Plaid left out into null (a cash security with no ticker or price, a holding with no cost basis), and no cash flag into false
 * - drops a holding in a security that was not described
 * - keeps nothing Plaid also sends, such as CUSIP, ISIN or SEDOL
 * - gives nothing for no holdings
 */
test.describe("normalizePlaidHoldings", () => {
  test("keeps a security's name, ticker, type, currency and close price, with dates as dates", () => {
    const { securities } = normalizePlaidHoldings(plaid({ securities: [security], holdings: [] }));

    expect(securities).toMatchObject([
      {
        plaidSecurityId: "sec-1",
        data: {
          name: "Apple Inc.",
          tickerSymbol: "AAPL",
          type: "equity",
          isCashEquivalent: false,
          isoCurrencyCode: "USD",
          closePrice: 189.5,
          closePriceAsOf: new Date("2026-10-14"),
        },
      },
    ]);
  });

  test("keeps a holding's quantity, price, value and cost basis, keyed by Plaid's account and security ids", () => {
    const { holdings } = normalizePlaidHoldings(plaid({ securities: [security], holdings: [holding] }));

    expect(holdings).toEqual([
      {
        providerAccountId: "acct",
        plaidSecurityId: "sec-1",
        data: {
          quantity: 10,
          institutionPrice: 190.25,
          institutionPriceAsOf: new Date("2026-10-14"),
          institutionValue: 1902.5,
          costBasis: 1500,
          isoCurrencyCode: "USD",
        },
      },
    ]);
  });

  test("turns what Plaid left out into null (a cash security with no ticker or price, a holding with no cost basis), and no cash flag into false", () => {
    const { securities, holdings } = normalizePlaidHoldings(
      plaid({
        securities: [{ security_id: "cash" }],
        holdings: [{ account_id: "acct", security_id: "cash", quantity: 250, institution_price: 1, institution_value: 250 }],
      }),
    );

    expect(securities[0]!.data).toMatchObject({
      name: null,
      tickerSymbol: null,
      type: null,
      isCashEquivalent: false,
      isoCurrencyCode: null,
      closePrice: null,
      closePriceAsOf: null,
    });
    expect(holdings[0]!.data).toMatchObject({ costBasis: null, isoCurrencyCode: null, institutionPriceAsOf: null });
  });

  test("drops a holding in a security that was not described", () => {
    const { holdings } = normalizePlaidHoldings(
      plaid({ securities: [security], holdings: [holding, { ...holding, security_id: "unknown-sec" }] }),
    );

    expect(holdings.map((h) => h.plaidSecurityId)).toEqual(["sec-1"]);
  });

  test("keeps nothing Plaid also sends, such as CUSIP, ISIN or SEDOL", () => {
    const { securities } = normalizePlaidHoldings(
      plaid({ securities: [{ ...security, cusip: "037833100", isin: "US0378331005", sedol: "2046251" }], holdings: [] }),
    );

    const stored = JSON.stringify(securities);
    for (const extra of ["037833100", "US0378331005", "2046251"]) {
      expect(stored).not.toContain(extra);
    }
  });

  test("gives nothing for no holdings", () => {
    expect(normalizePlaidHoldings(plaid({ securities: [], holdings: [] }))).toEqual({ securities: [], holdings: [] });
  });
});
