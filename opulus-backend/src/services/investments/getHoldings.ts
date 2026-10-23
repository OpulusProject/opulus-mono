import {
  accountRepository,
  addDays,
  BASE_CURRENCY,
  holdingRepository,
  investmentTransactionRepository,
  loadExchangeRateConverter,
  securityPriceRepository,
  toDay,
  holdingsRangeStart,
  toHoldingsDTO,
  type HoldingsRange,
  type HoldingsResponse,
} from "@opulus/core";

export interface GetHoldingsParams {
  userId: string;
  /** Only these accounts' holdings (our account ids). */
  accountIds?: string[];
  /** Only holdings of this security (our security id). */
  securityId?: string;
  /** The period the gains are over; the whole time held when omitted. */
  range?: HoldingsRange;
  /** The first and last day ("YYYY-MM-DD") of a `custom` range; the last defaults to today. */
  from?: string;
  to?: string;
  /** The current moment; only tests pass it. */
  now?: Date;
}

/**
 * A user's current investment holdings: each with its value, cost basis, gain
 * (since purchase, or over a range: the change in value over the period, not
 * counting what was bought or sold in it) and gain as a percentage, and what they add up to, in the base currency, with
 * the split by kind, currency and account. An investment account with no
 * holdings is counted by its balance.
 * Amounts in another currency are converted at today's stored rate. A holding is
 * valued at its quantity times our own price of the security (kept fresh by the
 * scheduler) when we have one, and as the institution reports it when we do not
 * (cash, options, bonds); quantities and cost bases are as fresh as Plaid's last
 * pull from the institution.
 */
export async function getHoldings(
  params: GetHoldingsParams
): Promise<HoldingsResponse["data"]> {
  const now = params.now ?? new Date();
  const today = toDay(now);
  const range = params.range ?? "all";
  const since = holdingsRangeStart(range, today, params.from);
  // A range that ended before today is looked at as of its last day.
  const until =
    range === "custom" && params.to && params.to < today ? params.to : null;
  const [rows, allAccounts, dividends, trades] = await Promise.all([
    holdingRepository.getAllByUserId(params.userId, {
      accountIds: params.accountIds,
      securityId: params.securityId,
    }),
    accountRepository.getAllByUserId(params.userId, ["investment"]),
    investmentTransactionRepository.getDividendsSince(
      params.userId,
      new Date(`${since ?? addDays(today, -364)}T00:00:00Z`)
    ),
    since
      ? investmentTransactionRepository.getTradesSince(
          params.userId,
          new Date(`${since}T00:00:00Z`)
        )
      : [],
  ]);
  // A security filter looks at holdings only: the accounts that hold it.
  const holders = new Set(rows.map((row) => row.accountId));
  const accounts = allAccounts.filter(
    (account) =>
      (!params.accountIds || params.accountIds.includes(account.id)) &&
      (!params.securityId || holders.has(account.id))
  );

  // Our own price of each security, where we have one; the rest are valued as
  // the institution reports them.
  const securityIds = [...new Set(rows.map((row) => row.securityId))];
  const prices = await securityPriceRepository.getLatest(securityIds);
  // Over a range, what each was worth on its first day.
  const startPrices = since
    ? await securityPriceRepository.getOn(securityIds, since)
    : new Map();
  const endPrices = until
    ? await securityPriceRepository.getOn(securityIds, until)
    : new Map();

  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: [
      ...rows.map((row) => row.isoCurrencyCode),
      ...[...prices.values()].map((price) => price.currency),
      ...[...startPrices.values()].map((price) => price.currency),
      ...[...endPrices.values()].map((price) => price.currency),
      ...trades.map((trade) => trade.isoCurrencyCode),
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
    prices,
    now,
    range,
    trades,
    startPrices,
    endPrices,
    until,
    from: params.from,
  });
}
