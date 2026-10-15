import {
  BASE_CURRENCY,
  accountRepository,
  addDays,
  fromUnits,
  historicBalanceRepository,
  isOwed,
  loadExchangeRateConverter,
  toDay,
  toUnits,
  toNumber,
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

type HistoricRow = { date: string; balance: number };

/**
 * One account's balance on each of the days, in whole units. Today is the live
 * balance. Every earlier day comes from the account's stored historic
 * balances: a day with none takes the latest earlier one (a missed night), and
 * a day before its first one takes the first (flat before the history starts).
 * An account with no historic balances at all is held at its live balance
 * throughout.
 */
function dailyBalances(
  live: number,
  rows: HistoricRow[],
  days: string[],
  today: string
): number[] {
  let latest = 0; // the last row on or before the day (the first, before any)
  return days.map((day) => {
    let balance = live;
    if (day < today && rows.length > 0) {
      while (latest + 1 < rows.length && rows[latest + 1]!.date <= day) {
        latest++;
      }
      balance = rows[latest]!.balance;
    }
    return toUnits(balance);
  });
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

  const [allAccounts, historicBalances] = await Promise.all([
    accountRepository.getAllByUserId(userId),
    historicBalanceRepository.getAllByUserId(userId),
  ]);
  const accounts = (
    accountIds
      ? allAccounts.filter((account) => accountIds.includes(account.id))
      : allAccounts
  ).filter((account) => toNumber(account.balanceCurrent) !== null);

  // Each account's closing balances, oldest first. Today and later are never
  // used: today is live.
  const history = new Map<string, HistoricRow[]>();
  for (const { accountId, date, balanceCurrent } of historicBalances) {
    if (date >= today) continue;
    const rows = history.get(accountId) ?? [];
    rows.push({ date, balance: balanceCurrent });
    history.set(accountId, rows);
  }

  const first =
    range === "all"
      ? (historicBalances.find((row) => row.date < today)?.date ?? today)
      : addDays(today, -RANGE_DAYS[range]);
  const days: string[] = [];
  for (let day = first; day <= today; day = addDays(day, 1)) days.push(day);

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
      history.get(account.id) ?? [],
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
