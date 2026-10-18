import type { Plaid, TransactionStream } from "../plaid-stub.js";

/** A stream in Plaid's snake_case. Plaid reports an outflow's amount as positive and an inflow's as negative. */
export const stream = (
  accountId: string,
  streamId: string,
  overrides: Plaid<TransactionStream> = {},
): Plaid<TransactionStream> => ({
  account_id: accountId,
  stream_id: streamId,
  description: "Streaming Service",
  merchant_name: "StreamCo",
  first_date: "2026-01-15",
  last_date: "2026-09-15",
  predicted_next_date: "2026-10-15",
  frequency: "MONTHLY",
  average_amount: { amount: 15.99, iso_currency_code: "CAD" },
  last_amount: { amount: 16.49, iso_currency_code: "CAD" },
  is_active: true,
  status: "MATURE",
  personal_finance_category: { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_TV_AND_MOVIES" },
  ...overrides,
});

export const payroll = (accountId: string, streamId: string) =>
  stream(accountId, streamId, {
    description: "Payroll",
    merchant_name: null,
    frequency: "BIWEEKLY",
    average_amount: { amount: -2100, iso_currency_code: "CAD" },
    last_amount: { amount: -2100, iso_currency_code: "CAD" },
    predicted_next_date: null,
    personal_finance_category: { primary: "INCOME", detailed: "INCOME_WAGES" },
  });
