import {
  accountRepository,
  BASE_CURRENCY,
  holdingRepository,
  loadExchangeRateConverter,
  toDay,
  toHoldingsDTO,
  type HoldingsResponse,
} from "@opulus/core";

export interface GetHoldingsParams {
  userId: string;
  /** Only this account's holdings (our account id). */
  accountId?: string;
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
  const [rows, allAccounts] = await Promise.all([
    holdingRepository.getAllByUserId(params.userId, {
      accountId: params.accountId,
    }),
    accountRepository.getAllByUserId(params.userId, ["investment"]),
  ]);
  const accounts = allAccounts.filter(
    (account) => !params.accountId || account.id === params.accountId
  );

  const today = toDay(now);
  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: [
      ...rows.map((row) => row.isoCurrencyCode),
      ...accounts.map((account) => account.isoCurrencyCode),
    ],
    days: [today],
  });

  return toHoldingsDTO(rows, {
    baseCurrency: BASE_CURRENCY,
    rateOn: (currency) => converter.rateOn(currency, today),
    accounts,
    now,
  });
}
