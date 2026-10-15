import type { TransactionDTO, TransactionsDayDTO } from '@opulus/core/dto';

import { formatMoney } from '@/utils/accountDisplay';

export interface TransactionDay {
  /** The day, as `YYYY-MM-DD`. */
  day: string;
  transactions: TransactionDTO[];
}

/**
 * A day's net change for its heading, from the server's per-day totals, which
 * are in one currency (the summary's base currency): "−$87.39" when more went
 * out than came in, "+$2,100.00" when more came in, "$0.00" when they cancel
 * out. Undefined when the totals have no entry for the day.
 */
export function dayNetLabel(
  byDay: TransactionsDayDTO[],
  baseCurrency: string,
  day: string
): string | undefined {
  const net = byDay.find((row) => row.date === day)?.net;
  return net === undefined ? undefined : formatNet(net, baseCurrency);
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

function formatNet(net: number, currency: string): string {
  if (net > 0) return `+${formatMoney(net, currency)}`;
  if (net < 0) return `\u2212${formatMoney(-net, currency)}`;
  return formatMoney(0, currency);
}
