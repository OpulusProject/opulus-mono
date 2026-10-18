import { expect, test } from "@playwright/test";
import { normalizePlaidInvestmentTransaction, normalizePlaidSecurity } from "@opulus/core";

const asTransaction = (value: unknown) => value as Parameters<typeof normalizePlaidInvestmentTransaction>[0];
const asSecurity = (value: unknown) => value as Parameters<typeof normalizePlaidSecurity>[0];

/**
 * Plaid's investment transactions and securities as we keep them
 * (opulus-core/src/repositories/{investmentTransaction,holding}Repository.ts).
 * Only what is not a plain copy is pinned: what becomes null, what is dropped,
 * and where Plaid's own shape (an extension of the SDK's types) is read.
 *
 * Test cases:
 * - a buy keeps its security, quantity, price and amount, with Plaid's sign (cash out is positive)
 * - a dividend keeps its subtype and a negative amount (cash in)
 * - a cash movement or fee has no security, so no quantity or price
 * - missing optional fields become null, and a missing amount zero
 * - an option's contract is kept, and a bond's maturity, face value and yield
 * - a security without those has nulls for them
 * - never keeps CUSIP, ISIN or SEDOL
 */
test.describe("normalize investment transactions and securities", () => {
  test("a buy keeps its security, quantity, price and amount, with Plaid's sign (cash out is positive)", () => {
    const row = normalizePlaidInvestmentTransaction(
      asTransaction({
        investment_transaction_id: "it-1",
        account_id: "acct",
        security_id: "sec-1",
        date: "2026-10-10",
        name: "BUY XEQT",
        type: "buy",
        subtype: "buy",
        quantity: 10,
        price: 33.8,
        amount: 338,
        fees: 0,
        iso_currency_code: "CAD",
      }),
    );

    expect(row).toEqual({
      plaidInvestmentTransactionId: "it-1",
      providerAccountId: "acct",
      plaidSecurityId: "sec-1",
      data: {
        date: new Date("2026-10-10"),
        name: "BUY XEQT",
        type: "buy",
        subtype: "buy",
        quantity: 10,
        price: 33.8,
        amount: 338,
        fees: 0,
        isoCurrencyCode: "CAD",
        unofficialCurrencyCode: null,
      },
    });
  });

  test("a dividend keeps its subtype and a negative amount (cash in)", () => {
    const row = normalizePlaidInvestmentTransaction(
      asTransaction({
        investment_transaction_id: "it-2",
        account_id: "acct",
        security_id: "sec-1",
        date: "2026-10-14",
        name: "DIVIDEND XIC",
        type: "cash",
        subtype: "dividend",
        quantity: 0,
        price: 0,
        amount: -62.1,
        fees: null,
      }),
    );

    expect(row.data).toMatchObject({ type: "cash", subtype: "dividend", amount: -62.1, fees: null });
  });

  test("a cash movement or fee has no security, so no quantity or price", () => {
    const deposit = normalizePlaidInvestmentTransaction(
      asTransaction({
        investment_transaction_id: "it-3",
        account_id: "acct",
        security_id: null,
        date: "2026-10-01",
        name: "Contribution",
        type: "cash",
        subtype: "contribution",
        quantity: 0,
        price: 0,
        amount: -500,
      }),
    );

    expect(deposit.plaidSecurityId).toBeNull();
    expect(deposit.data).toMatchObject({ quantity: null, price: null, amount: -500 });
  });

  test("missing optional fields become null, and a missing amount zero", () => {
    const row = normalizePlaidInvestmentTransaction(
      asTransaction({ investment_transaction_id: "it-4", account_id: "acct", date: "2026-10-02", name: "Fee", type: "fee" }),
    );

    expect(row.data).toMatchObject({ subtype: null, fees: null, isoCurrencyCode: null, unofficialCurrencyCode: null, amount: 0 });
  });

  test("an option's contract is kept, and a bond's maturity, face value and yield", () => {
    const option = normalizePlaidSecurity(
      asSecurity({
        security_id: "opt",
        type: "derivative",
        name: "AAPL Jan 15 2027 $250 call",
        market_identifier_code: "XNAS",
        option_contract: { contract_type: "call", expiration_date: "2027-01-15", strike_price: 250, underlying_security_ticker: "AAPL" },
      }),
    );
    const bond = normalizePlaidSecurity(
      asSecurity({
        security_id: "bond",
        type: "fixed income",
        unofficial_currency_code: null,
        fixed_income: { maturity_date: "2030-06-01", issue_date: "2020-06-01", face_value: 5000, yield_rate: { percentage: 2.75, type: "coupon" } },
      }),
    );

    expect(option.data).toMatchObject({
      marketIdentifierCode: "XNAS",
      optionContractType: "call",
      optionExpirationDate: new Date("2027-01-15"),
      optionStrikePrice: 250,
      optionUnderlyingTicker: "AAPL",
      bondMaturityDate: null,
    });
    expect(bond.data).toMatchObject({
      bondMaturityDate: new Date("2030-06-01"),
      bondIssueDate: new Date("2020-06-01"),
      bondFaceValue: 5000,
      bondYieldRate: 2.75,
      bondYieldType: "coupon",
      optionContractType: null,
    });
  });

  test("a security without those has nulls for them", () => {
    const { data } = normalizePlaidSecurity(asSecurity({ security_id: "plain", name: "Cash", type: "cash" }));

    expect(data).toMatchObject({
      marketIdentifierCode: null,
      optionContractType: null,
      optionExpirationDate: null,
      optionStrikePrice: null,
      optionUnderlyingTicker: null,
      bondMaturityDate: null,
      bondFaceValue: null,
      bondYieldRate: null,
      bondYieldType: null,
      unofficialCurrencyCode: null,
    });
  });

  test("never keeps CUSIP, ISIN or SEDOL", () => {
    const security = normalizePlaidSecurity(
      asSecurity({ security_id: "s", cusip: "037833100", isin: "US0378331005", sedol: "2046251", institution_security_id: "inst-77" }),
    );

    const stored = JSON.stringify(security);
    for (const identifier of ["037833100", "US0378331005", "2046251", "inst-77"]) {
      expect(stored).not.toContain(identifier);
    }
  });
});
