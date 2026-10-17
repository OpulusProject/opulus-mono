import type { Holding, Plaid, Security } from "../plaid-stub.js";

/** Plaid's holdings answer for some accounts, in Plaid's snake_case. */
export const answer = (
  accountIds: string[],
  holdings: Plaid<Holding>[],
  securities: Plaid<Security>[],
) => ({
  response: {
    accounts: accountIds.map((account_id) => ({ account_id })),
    holdings,
    securities,
  },
});

export const holding = (accountId: string, securityId: string, quantity: number, price: number, costBasis: number | null = null, currency = "USD"): Plaid<Holding> => ({
  account_id: accountId,
  security_id: securityId,
  quantity,
  institution_price: price,
  institution_price_as_of: "2026-10-14",
  institution_value: quantity * price,
  cost_basis: costBasis,
  iso_currency_code: currency,
});

export const apple = (id: string): Plaid<Security> => ({
  security_id: id,
  name: "Apple Inc.",
  ticker_symbol: "AAPL",
  type: "equity",
  is_cash_equivalent: false,
  iso_currency_code: "USD",
  close_price: 189.5,
  close_price_as_of: "2026-10-14",
});
export const microsoft = (id: string) => ({ ...apple(id), name: "Microsoft Corp.", ticker_symbol: "MSFT" });
export const cash = (id: string): Plaid<Security> => ({
  security_id: id,
  name: "Cash",
  ticker_symbol: "CAD",
  type: "cash",
  is_cash_equivalent: true,
  iso_currency_code: "CAD",
  close_price: null,
  close_price_as_of: null,
});
