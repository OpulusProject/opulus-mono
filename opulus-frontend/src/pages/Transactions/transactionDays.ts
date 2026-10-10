import type { TransactionDTO } from '@opulus/core/dto';

import { formatMoney } from '@/utils/accountDisplay';

export interface TransactionDay {
  /** The day, as `YYYY-MM-DD`. */
  day: string;
  transactions: TransactionDTO[];
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

/**
 * The net change of these transactions, per currency, signed: "−$87.39" when
 * more went out than came in, "+$2,100.00" when more came in, "$0.00" when they
 * cancel out. Currencies are in code order, separated by "·": "+$26.04 · −US$29.00".
 */
export function netLabel(transactions: TransactionDTO[]): string {
  const byCurrency = new Map<string | null, number>();
  for (const { amount, isoCurrencyCode } of transactions) {
    // Plaid's amounts are positive for money out, so the change is the negative.
    byCurrency.set(
      isoCurrencyCode,
      (byCurrency.get(isoCurrencyCode) ?? 0) - amount
    );
  }
  return [...byCurrency]
    .sort(([a], [b]) => (a ?? '').localeCompare(b ?? ''))
    .map(([currency, net]) => formatNet(Math.round(net * 100) / 100, currency))
    .join(' · ');
}

function formatNet(net: number, currency: string | null): string {
  if (net > 0) return `+${formatMoney(net, currency)}`;
  if (net < 0) return `\u2212${formatMoney(-net, currency)}`;
  return formatMoney(0, currency);
}
