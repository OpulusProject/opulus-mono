import type { TransactionDTO, TransactionsDayDTO } from '@opulus/core/dto';

import { formatMoney } from '@/utils/accountDisplay';

export interface TransactionDay {
  /** The day, as `YYYY-MM-DD`. */
  day: string;
  transactions: TransactionDTO[];
}

/**
 * A day's net change for its heading, from the server's per-day totals: "−$87.39"
 * when more went out than came in, "+$2,100.00" when more came in, "$0.00" when
 * they cancel out. Currencies come in code order (the server's), separated by
 * "·": "+$26.04 · −US$29.00". Undefined when the totals have no entry for the day.
 */
export function dayNetLabel(
  byDay: TransactionsDayDTO[],
  day: string
): string | undefined {
  const rows = byDay.filter((row) => row.date === day);
  if (rows.length === 0) return undefined;
  return rows.map(({ currency, net }) => formatNet(net, currency)).join(' · ');
}

/**
 * Group transactions by day. They arrive newest first, so each day's
 * transactions are next to each other and the days come out in order.
 */
export function groupByDay(transactions: TransactionDTO[]): TransactionDay[] {
  const days: TransactionDay[] = [];
  for (const transaction of transactions) {
    const day = transaction.date.slice(0, 10);
    const last = days[days.length - 1];
    if (last?.day === day) last.transactions.push(transaction);
    else days.push({ day, transactions: [transaction] });
  }
  return days;
}

function formatNet(net: number, currency: string | null): string {
  if (net > 0) return `+${formatMoney(net, currency)}`;
  if (net < 0) return `\u2212${formatMoney(-net, currency)}`;
  return formatMoney(0, currency);
}
