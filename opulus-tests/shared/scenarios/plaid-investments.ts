import type { Holding, InvestmentTransaction, Plaid, Security } from "../plaid-stub.js";

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

/** The day `days` days ago, as Plaid writes a date ("YYYY-MM-DD", UTC). */
export const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/** A buy of a security (cash out is positive, as Plaid signs it). */
export const buy = (
  accountId: string,
  id: string,
  securityId: string,
  date: string,
  quantity = 10,
  price = 100,
): Plaid<InvestmentTransaction> => ({
  investment_transaction_id: id,
  account_id: accountId,
  security_id: securityId,
  date,
  name: `BUY ${securityId}`,
  type: "buy",
  subtype: "buy",
  quantity,
  price,
  amount: quantity * price,
  fees: 0,
  iso_currency_code: "USD",
});

/** A dividend paid on a security (cash in, so negative). */
export const dividend = (accountId: string, id: string, securityId: string, date: string, amount = 25): Plaid<InvestmentTransaction> => ({
  investment_transaction_id: id,
  account_id: accountId,
  security_id: securityId,
  date,
  name: `DIVIDEND ${securityId}`,
  type: "cash",
  subtype: "dividend",
  quantity: 0,
  price: 0,
  amount: -amount,
  fees: null,
  iso_currency_code: "USD",
});

/** Plaid's investment transactions answer: what it reports and the securities they mention, for these accounts (the item's own if none are named). */
export const transactionsAnswer = (
  investment_transactions: Plaid<InvestmentTransaction>[],
  securities: Plaid<Security>[] = [],
  accountIds?: string[],
) => ({
  response: {
    ...(accountIds && { accounts: accountIds.map((account_id) => ({ account_id })) }),
    investment_transactions,
    securities,
  },
});
