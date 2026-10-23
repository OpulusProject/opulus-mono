import { ReceiptText } from 'lucide-react';
import { useMemo } from 'react';

import {
  List,
  ListEmpty,
  ListError,
  ListFooter,
  ListGroup,
  ListHeader,
} from '@/common/List';
import { Page } from '@/common/Page';
import { TransactionRow } from '@/common/TransactionRow';
import { Button, Spinner } from '@/components/ui';
import { useDailyTransactionTotals } from '@/hooks/transactions/useDailyTransactionTotals';
import { useInfiniteTransactions } from '@/hooks/transactions/useInfiniteTransactions';
import { useOnVisible } from '@/hooks/use-on-visible';
import { formatDay } from '@/utils/day';

import { dayNetLabel, groupByDay } from './transactionDays';
import { TransactionFilters } from './TransactionFilters';
import { TransactionsAccountFilter } from './TransactionsAccountFilter';
import { TransactionsDateFilter } from './TransactionsDateFilter';
import { TransactionSearch } from './TransactionSearch';
import { useTransactionFilters } from './useTransactionFilters';

export const Transactions: React.FC = () => {
  const { search, update } = useTransactionFilters();

  return (
    <Page
      title="Transactions"
      description="Search everything you've spent and received."
      requiresConnections={{
        title: 'No transactions yet',
        description: 'Connect an account to see your transactions here.',
      }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <TransactionsDateFilter search={search} onChange={update} />
          <TransactionsAccountFilter
            selected={search.account ?? []}
            onChange={(account) => update({ account })}
          />
        </div>
      }
    >
      <TransactionsContent />
    </Page>
  );
};

// Its own component so that its queries wait until the page knows something is
// connected.
const TransactionsContent: React.FC = () => {
  const { search, filters, update, hasFilters, clearFilters, isFiltered } =
    useTransactionFilters();
  const query = search.q ?? '';
  const setQuery = (q: string) => update({ q });

  const list = useInfiniteTransactions(filters);
  // Each day's net comes from the server for the same filters, so it is whole
  // however much of the list has loaded.
  const dailyTotals = useDailyTransactionTotals(filters);

  const transactions = useMemo(
    () => list.data?.pages.flatMap((page) => page.transactions) ?? [],
    [list.data]
  );
  const days = useMemo(() => groupByDay(transactions), [transactions]);
  const total = list.data?.pages[0]?.pagination.total ?? 0;

  // Reaching the end of the list loads the next page. The marker in the footer
  // is what is watched; after a failed load it gives way to a retry button.
  const loadMore = () => void list.fetchNextPage();
  const loadFailed = list.isFetchNextPageError;
  const loadMoreRef = useOnVisible<HTMLDivElement>(loadMore, {
    enabled: list.hasNextPage && !list.isFetchingNextPage && !loadFailed,
    rootMargin: '300px',
  });

  const hasResults = !list.isError && transactions.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <TransactionSearch value={query} onChange={setQuery} />

      {/* The previous results stay up while new ones load; the list dims them. */}
      <List
        aria-label="Transactions"
        isLoading={list.isLoading}
        isRefreshing={list.isPlaceholderData}
      >
        <ListHeader
          title={
            list.isLoading
              ? 'Transactions'
              : `${total} ${total === 1 ? 'transaction' : 'transactions'}`
          }
          titleAction={
            hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            ) : undefined
          }
          action={({ width }) => (
            <TransactionFilters
              search={search}
              width={width}
              onChange={update}
            />
          )}
        />
        {list.isError ? (
          <ListError
            subject="transactions"
            onRetry={() => void list.refetch()}
          />
        ) : transactions.length === 0 ? (
          <TransactionsEmpty isFiltered={isFiltered} />
        ) : (
          days.map(({ day, transactions: rows }) => (
            <ListGroup
              key={day}
              title={formatDay(day)}
              trailingTitle={
                dailyTotals.data &&
                dayNetLabel(
                  dailyTotals.data.byDay,
                  dailyTotals.data.baseCurrency,
                  day
                )
              }
            >
              {rows.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                />
              ))}
            </ListGroup>
          ))
        )}
        {hasResults && (
          <ListFooter
            summary={`Showing ${transactions.length} of ${total}`}
            action={
              loadFailed ? (
                <Button variant="outline" size="sm" onClick={loadMore}>
                  Try again
                </Button>
              ) : list.hasNextPage ? (
                <div
                  ref={loadMoreRef}
                  role="status"
                  aria-label="Loading more transactions"
                  className="size-4"
                >
                  {list.isFetchingNextPage && <Spinner />}
                </div>
              ) : undefined
            }
          />
        )}
      </List>
    </div>
  );
};

/** Why there are no transactions: nothing matched, or none have synced yet. */
const TransactionsEmpty: React.FC<{ isFiltered: boolean }> = ({
  isFiltered,
}) =>
  isFiltered ? (
    <ListEmpty
      icon={ReceiptText}
      title="No transactions found"
      description="Nothing matches. Try a different search or fewer filters."
    />
  ) : (
    <ListEmpty
      icon={ReceiptText}
      title="No transactions yet"
      description="Transactions from your connected accounts will appear here once they finish syncing."
    />
  );
