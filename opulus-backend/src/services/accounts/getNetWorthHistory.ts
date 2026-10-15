import {
  BASE_CURRENCY,
  accountRepository,
  addDays,
  balanceDirection,
  fromUnits,
  isOwed,
  loadExchangeRateConverter,
  toDay,
  toUnits,
  toNumber,
  transactionRepository,
  type NetWorthPointDTO,
  type NetWorthRange,
} from "@opulus/core";

export interface GetNetWorthHistoryParams {
  userId: string;
  range: NetWorthRange;
  /**
   * Only these accounts. Ids that are not the user's accounts are ignored, so
   * they just leave nothing to add up. All of the user's accounts if omitted.
   */
  accountIds?: string[];
  /** The current moment; only tests pass it. */
  now?: Date;
}

export interface GetNetWorthHistoryResult {
  /** In the base currency; empty when no account has a balance. */
  points: NetWorthPointDTO[];
}

/** Days back from today for each range but "all". */
const RANGE_DAYS = { "1w": 7, "1m": 30, "3m": 90, "1y": 365 } as const;

/**
 * One account's balance on each of the days, in whole units. Today is the live
 * balance. An earlier day's is worked out from it and the account's posted
 * transactions since: the live balance with every later transaction undone
 * (see `balanceDirection` for which way). So a transaction that is added,
 * changed or removed, or a refund, is in the history the next time it is read.
 * A day with no transactions after it, or an account whose balance
 * transactions do not explain (investments), is the live balance.
 *
 * @param live - The balance today
 * @param direction - From `balanceDirection`
 * @param changes - What the account's posted transactions add up to on each
 *   day, in whole units, for days after the first of `days`
 * @param days - Consecutive days, oldest first, ending today
 */
function dailyBalances(
  live: number,
  direction: 1 | -1 | 0,
  changes: Map<string, number>,
  days: string[],
  today: string
): number[] {
  // What came after the day being worked out; starts as what is dated after
  // today (nothing, usually).
  let after = 0;
  for (const [date, units] of changes) if (date > today) after += units;

  const balances: number[] = new Array(days.length);
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i]!;
    balances[i] = toUnits(live) + (day < today ? direction * after : 0);
    // The day just worked out comes after the one before it.
    after += changes.get(day) ?? 0;
  }
  return balances;
}

/**
 * A user's net worth in the base currency for each day in a range: each
 * account's daily balances (see `dailyBalances`) converted at that day's rate
 * and added up, with what is owed subtracted. Today is the accounts' live
 * balances, so the last point always equals what the accounts add up to now.
 */
export async function getNetWorthHistory(
  params: GetNetWorthHistoryParams
): Promise<GetNetWorthHistoryResult> {
  const { userId, range, accountIds, now = new Date() } = params;
  const today = toDay(now);

  const allAccounts = await accountRepository.getAllByUserId(userId);
  const accounts = (
    accountIds
      ? allAccounts.filter((account) => accountIds.includes(account.id))
      : allAccounts
  ).filter((account) => toNumber(account.balanceCurrent) !== null);
  const ids = accounts.map((account) => account.id);

  // "all" starts at the earliest posted transaction: before it nothing is known.
  const earliest =
    range === "all" && ids.length > 0
      ? await transactionRepository.getEarliestPostedDate(userId, ids)
      : null;
  const first =
    range === "all"
      ? earliest !== null && earliest < today
        ? earliest
        : today
      : addDays(today, -RANGE_DAYS[range]);
  const days: string[] = [];
  for (let day = first; day <= today; day = addDays(day, 1)) days.push(day);

  // What each account's transactions add up to on each day after the first.
  const changes = new Map<string, Map<string, number>>();
  if (ids.length > 0) {
    for (const row of await transactionRepository.getDailyChangesByAccount(
      userId,
      ids,
      first
    )) {
      const byDay = changes.get(row.accountId) ?? new Map<string, number>();
      byDay.set(row.date, toUnits(row.total));
      changes.set(row.accountId, byDay);
    }
  }

  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: accounts.map((account) => account.isoCurrencyCode),
    days: [first, today],
  });

  // Net worth per day in the base currency, in whole units (before rounding).
  const totals = days.map(() => 0);
  for (const account of accounts) {
    const sign = isOwed(account.type) ? -1 : 1;
    const balances = dailyBalances(
      toNumber(account.balanceCurrent)!,
      balanceDirection(account.type),
      changes.get(account.id) ?? new Map<string, number>(),
      days,
      today
    );

    const rates = days.map((day) =>
      converter.rateOn(account.isoCurrencyCode, day)
    );

    balances.forEach((units, index) => {
      totals[index] = totals[index]! + sign * units * rates[index]!;
    });
  }

  return {
    points:
      accounts.length === 0
        ? []
        : days.map((day, index) => ({
            date: day,
            netWorth: fromUnits(Math.round(totals[index]!)),
          })),
  };
}
