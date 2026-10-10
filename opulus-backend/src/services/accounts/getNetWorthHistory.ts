import {
  accountRepository,
  addDays,
  historicBalanceRepository,
  toDay,
  toNumber,
  type NetWorthRange,
  type NetWorthSeriesDTO,
} from "@opulus/core";

export interface GetNetWorthHistoryParams {
  userId: string;
  range: NetWorthRange;
  /** The current moment; only tests pass it. */
  now?: Date;
}

export interface GetNetWorthHistoryResult {
  series: NetWorthSeriesDTO[];
}

/** Days back from today for each range but "all". */
const RANGE_DAYS = { "1w": 7, "1m": 30, "3m": 90, "1y": 365 } as const;

/** Plaid's amounts have at most 4 decimals; whole units avoid float drift. */
const SCALE = 10_000;

/** Credit and loan balances are what is owed (Plaid reports them positive). */
const isOwed = (type: string) => type === "credit" || type === "loan";

/**
 * A user's net worth for each day in a range, one series per currency.
 *
 * Today is the accounts' live balances, so the last point always equals what
 * the accounts add up to now. Every earlier day comes from the stored
 * historic balances, per account: a day with none takes the account's latest
 * earlier one (a missed night), and a day before its first one takes the first
 * (flat before the history starts). An account with no historic balances at
 * all is held at its live balance throughout.
 */
export async function getNetWorthHistory(
  params: GetNetWorthHistoryParams
): Promise<GetNetWorthHistoryResult> {
  const { userId, range, now = new Date() } = params;
  const today = toDay(now);

  const [accounts, historicBalances] = await Promise.all([
    accountRepository.getAllByUserId(userId),
    historicBalanceRepository.getAllByUserId(userId),
  ]);

  // Each account's closing balances, oldest first. Today and later are never
  // used: today is live.
  const history = new Map<string, { date: string; balance: number }[]>();
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

  // Net worth per currency per day, in whole units.
  const totals = new Map<string | null, Map<string, number>>();
  for (const account of accounts) {
    const live = toNumber(account.balanceCurrent);
    if (live === null) continue;
    const sign = isOwed(account.type) ? -1 : 1;
    const rows = history.get(account.id) ?? [];
    const perDay = totals.get(account.isoCurrencyCode) ?? new Map();
    totals.set(account.isoCurrencyCode, perDay);

    let latest = 0; // the last row on or before the day (the first, before any)
    for (const day of days) {
      let balance = live;
      if (day < today && rows.length > 0) {
        while (latest + 1 < rows.length && rows[latest + 1]!.date <= day) {
          latest++;
        }
        balance = rows[latest]!.balance;
      }
      perDay.set(
        day,
        (perDay.get(day) ?? 0) + sign * Math.round(balance * SCALE)
      );
    }
  }

  const series = [...totals.entries()]
    .map(([currency, perDay]) => ({
      currency,
      points: days.map((day) => ({
        date: day,
        netWorth: (perDay.get(day) ?? 0) / SCALE,
      })),
    }))
    .sort((a, b) => (a.currency ?? "").localeCompare(b.currency ?? ""));

  return { series };
}
