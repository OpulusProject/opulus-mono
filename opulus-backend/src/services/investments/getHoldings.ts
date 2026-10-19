import {
  accountRepository,
  addDays,
  BASE_CURRENCY,
  holdingRepository,
  investmentTransactionRepository,
  loadExchangeRateConverter,
  toDay,
  toHoldingsDTO,
  type HoldingsResponse,
} from "@opulus/core";

export interface GetHoldingsParams {
  userId: string;
  /** Only these accounts' holdings (our account ids). */
  accountIds?: string[];
  /** Only accounts of this subtype (tfsa, rrsp, ...). */
  accountSubtype?: string;
  /** Only holdings of this security (our security id). */
  securityId?: string;
  /** Largest first (the default), or account by account. */
  sort?: "value" | "account";
  /** The current moment; only tests pass it. */
  now?: Date;
}

/**
 * A user's current investment holdings: each with its value, cost basis, gain
 * and gain as a percentage, and what they add up to, in the base currency, with
 * the split by kind, currency and account. An investment account with no
 * holdings is counted by its balance.
 * Amounts in another currency are converted at today's stored rate. The data is
 * as fresh as Plaid's last pull from the institution.
 */
export async function getHoldings(
  params: GetHoldingsParams
): Promise<HoldingsResponse["data"]> {
  const now = params.now ?? new Date();
  const today = toDay(now);
  const [rows, allAccounts, dividends] = await Promise.all([
    holdingRepository.getAllByUserId(params.userId, {
      accountIds: params.accountIds,
      accountSubtype: params.accountSubtype,
      securityId: params.securityId,
    }),
    accountRepository.getAllByUserId(params.userId, ["investment"]),
    investmentTransactionRepository.getDividendsSince(
      params.userId,
      new Date(`${addDays(today, -364)}T00:00:00Z`)
    ),
  ]);
  // A security filter looks at holdings only: the accounts that hold it.
  const holders = new Set(rows.map((row) => row.accountId));
  const accounts = allAccounts.filter(
    (account) =>
      (!params.accountIds || params.accountIds.includes(account.id)) &&
      (!params.accountSubtype || account.subtype === params.accountSubtype) &&
      (!params.securityId || holders.has(account.id))
  );

  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: [
      ...rows.map((row) => row.isoCurrencyCode),
      ...accounts.map((account) => account.isoCurrencyCode),
      ...dividends.map((payment) => payment.isoCurrencyCode),
    ],
    days: [today],
  });

  return toHoldingsDTO(rows, {
    baseCurrency: BASE_CURRENCY,
    rateOn: (currency) => converter.rateOn(currency, today),
    accounts,
    dividends,
    sort: params.sort,
    now,
  });
}
