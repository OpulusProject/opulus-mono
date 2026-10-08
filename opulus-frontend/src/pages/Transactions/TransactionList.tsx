import type { TransactionDTO } from '@opulus/core/dto';
import React, { useMemo } from 'react';

import { ListRow } from '@/common/ListRow';
import { Button, Spinner } from '@/components/ui';
import { formatMoney } from '@/utils/accountDisplay';
import { formatDay } from '@/utils/day';
import { getCategoryIcon, getCategoryLabel } from '@/utils/transactionCategory';

interface TransactionListProps {
  transactions: TransactionDTO[];
  /** How many transactions match the filters, loaded or not. */
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

/**
 * What was spent in these transactions (money out), per currency: "$12.00", or
 * "$12.00 + US$3.00" across currencies (in currency code order). Null when
 * nothing was spent.
 */
function spentLabel(transactions: TransactionDTO[]): string | null {
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

/**
 * The rows of the transactions table, in pages: "Load more" adds the next
 * page, under a heading for each day with what was spent that day.
 *
 * The pages are an unbroken run from the newest transaction, so every day is
 * complete except possibly the last one while there are more pages to load. Its
 * total waits until the rest of its transactions are in.
 */
export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  total,
  hasMore,
  isLoadingMore,
  onLoadMore,
}) => {
  const days = useMemo(() => {
    const groups: Array<{ day: string; transactions: TransactionDTO[] }> = [];
    for (const transaction of transactions) {
      const day = transaction.date.slice(0, 10);
      const last = groups[groups.length - 1];
      if (last?.day === day) last.transactions.push(transaction);
      else groups.push({ day, transactions: [transaction] });
    }
    return groups;
  }, [transactions]);

  return (
    <>
      {days.map(({ day, transactions: rows }, index) => {
        const isLastLoadedDay = index === days.length - 1;
        const spent = isLastLoadedDay && hasMore ? null : spentLabel(rows);
        return (
          <section key={day}>
            <div className="bg-muted/40 flex items-baseline justify-between border-b px-4 py-2 text-sm">
              <h3 className="font-medium">{formatDay(day)}</h3>
              {spent && (
                <span className="text-muted-foreground text-xs tabular-nums">
                  Spent {spent}
                </span>
              )}
            </div>
            <Rows transactions={rows} />
          </section>
        );
      })}

      <div className="flex flex-col items-center gap-2 p-4">
        <p className="text-muted-foreground text-xs">
          Showing {transactions.length} of {total}
        </p>
        {hasMore && (
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore && <Spinner />}
            Load more
          </Button>
        )}
      </div>
    </>
  );
};

interface RowsProps {
  transactions: TransactionDTO[];
}

const Rows: React.FC<RowsProps> = ({ transactions }) => (
  <div className="divide-y">
    {transactions.map((transaction) => (
      <TransactionRow key={transaction.id} transaction={transaction} />
    ))}
  </div>
);

interface TransactionRowProps {
  transaction: TransactionDTO;
}

const TransactionRow: React.FC<TransactionRowProps> = ({ transaction }) => {
  const { account, category } = transaction;
  const moneyIn = transaction.amount < 0;
  const amount = formatMoney(
    Math.abs(transaction.amount),
    transaction.isoCurrencyCode
  );

  return (
    <ListRow
      logoUrl={transaction.logoUrl}
      icon={getCategoryIcon(category?.primary)}
      title={transaction.merchantName || transaction.name}
      subtitle={[
        getCategoryLabel(category?.primary),
        `${account.name}${account.mask ? ` ••${account.mask}` : ''}`,
      ]
        .filter(Boolean)
        .join(' · ')}
      notices={
        transaction.pending ? [{ text: 'Pending', tone: 'muted' }] : undefined
      }
      trailingTitle={moneyIn ? `+${amount}` : amount}
    />
  );
};
