/**
 * Rebuilding an item's balance history from its transactions, for the days
 * before it was linked. Pure: no database, no clock (the caller passes today).
 */

/**
 * Whether Plaid has loaded all of an item's transaction history, from the
 * `transactions_update_status` of a /transactions/sync response. Only then are
 * the transactions complete enough to rebuild the balance history from: an
 * earlier status (NOT_READY, INITIAL_UPDATE_COMPLETE) means older transactions
 * are still to come, and nothing says in what order they will.
 */
export function isTransactionHistoryComplete(
  status: string | null | undefined
): boolean {
  return status === "HISTORICAL_UPDATE_COMPLETE";
}

export interface BalanceHistoryAccount {
  id: string;
  /** Plaid's account type: "depository", "credit", "loan", "investment", ... */
  type: string;
  /** The account's balance today; accounts without one are skipped. */
  balanceCurrent: number | null;
  isoCurrencyCode: string | null;
}

export interface BalanceHistoryTransaction {
  accountId: string;
  /** The day the transaction happened, "YYYY-MM-DD". */
  date: string;
  /** Plaid's sign: positive is money out. */
  amount: number;
}

export interface BalanceHistoryRow {
  accountId: string;
  /** The day the balance closed, "YYYY-MM-DD". */
  date: string;
  balanceCurrent: number;
  isoCurrencyCode: string | null;
}

/** Plaid's amounts have at most 4 decimals; whole units avoid float drift. */
const SCALE = 10_000;
const toUnits = (amount: number) => Math.round(amount * SCALE);

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * How a past balance follows from today's and the transactions in between.
 * Depository: money out since then lowers today's balance, so add it back.
 * Credit and loan balances are what is owed: spending since then raised it, so
 * take it off. Anything else (investments, whose value also moves with the
 * market, which transactions cannot tell us) is held flat.
 */
function sign(type: string): 1 | -1 | 0 {
  switch (type) {
    case "depository":
      return 1;
    case "credit":
    case "loan":
      return -1;
    default:
      return 0;
  }
}

/**
 * The closing balance of each account on each day from the item's earliest
 * transaction up to yesterday. Today is left out: the live balance is that.
 *
 * The balance on a day is today's balance with every transaction after that
 * day undone, so it is an estimate: it is only as complete as the transactions
 * (pending ones should be left out by the caller, and Plaid only reaches back
 * so far). Returns nothing when there are no transactions, since there is then
 * no window to fill.
 */
export function reconstructBalanceHistory(input: {
  accounts: BalanceHistoryAccount[];
  transactions: BalanceHistoryTransaction[];
  /** Today, "YYYY-MM-DD" (UTC). */
  today: string;
}): BalanceHistoryRow[] {
  const { accounts, transactions, today } = input;
  if (transactions.length === 0) return [];

  const first = transactions.reduce(
    (earliest, { date }) => (date < earliest ? date : earliest),
    transactions[0]!.date
  );
  const yesterday = addDays(today, -1);
  if (first > yesterday) return [];

  // Each account's total per day, in whole units.
  const byAccount = new Map<string, Map<string, number>>();
  for (const { accountId, date, amount } of transactions) {
    const days = byAccount.get(accountId) ?? new Map<string, number>();
    days.set(date, (days.get(date) ?? 0) + toUnits(amount));
    byAccount.set(accountId, days);
  }

  const rows: BalanceHistoryRow[] = [];
  for (const account of accounts) {
    if (account.balanceCurrent === null) continue;
    const current = toUnits(account.balanceCurrent);
    const direction = sign(account.type);
    const totals = byAccount.get(account.id);

    // Walking back from yesterday: what happened after the day being closed.
    // Today's transactions come after yesterday.
    let after = 0;
    if (totals) {
      for (const [date, total] of totals) if (date >= today) after += total;
    }
    for (let day = yesterday; day >= first; day = addDays(day, -1)) {
      rows.push({
        accountId: account.id,
        date: day,
        balanceCurrent: (current + direction * after) / SCALE,
        isoCurrencyCode: account.isoCurrencyCode,
      });
      after += totals?.get(day) ?? 0;
    }
  }
  return rows;
}
