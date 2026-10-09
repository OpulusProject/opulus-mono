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
 * What was spent in these transactions (money out), per currency: "$12.00", or
 * "$12.00 + US$3.00" across currencies (in currency code order). Null when
 * nothing was spent.
 */
export function spentLabel(transactions: TransactionDTO[]): string | null {
  const byCurrency = new Map<string | null, number>();
  for (const { amount, isoCurrencyCode } of transactions) {
    if (amount > 0) {
      byCurrency.set(
        isoCurrencyCode,
        (byCurrency.get(isoCurrencyCode) ?? 0) + amount
      );
    }
  }
  if (byCurrency.size === 0) return null;
  return [...byCurrency]
    .sort(([a], [b]) => (a ?? '').localeCompare(b ?? ''))
    .map(([currency, amount]) => formatMoney(amount, currency))
    .join(' + ');
}
