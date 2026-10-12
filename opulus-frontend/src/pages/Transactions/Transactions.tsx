import { useMemo } from 'react';

import {
  List,
  ListError,
  ListFooter,
  ListGroup,
  ListHeader,
} from '@/common/List';
import { Page } from '@/common/Page';
import { Button, Spinner } from '@/components/ui';
import { useInfiniteTransactions } from '@/hooks/transactions/useInfiniteTransactions';
import { useOnVisible } from '@/hooks/use-on-visible';
import { formatDay } from '@/utils/day';

import { groupByDay, netLabel } from './transactionDays';
import { TransactionFilters } from './TransactionFilters';
import { TransactionRow } from './TransactionRow';
import { TransactionSearch } from './TransactionSearch';
import { TransactionsEmpty } from './TransactionsEmpty';
import { useTransactionFilters } from './useTransactionFilters';

export const Transactions: React.FC = () => (
  <Page
    title="Transactions"
    description="Search everything you've spent and received."
    requiresConnections
    className="gap-4"
  >
    <TransactionsContent />
  </Page>
);

// Its own component so that its queries wait until the page knows something is
// connected.
const TransactionsContent: React.FC = () => {
  const { search, filters, update, hasFilters, clearFilters, isFiltered } =
    useTransactionFilters();
  const query = search.q ?? '';
  const setQuery = (q: string) => update({ q });

  const list = useInfiniteTransactions(filters);

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

  let content: React.ReactNode;
  if (list.isError) {
    content = (
      <ListError subject="transactions" onRetry={() => void list.refetch()} />
    );
  } else if (transactions.length === 0) {
    content = <TransactionsEmpty isFiltered={isFiltered} />;
  } else {
    // The pages are an unbroken run from the newest transaction, so every day is
    // complete except possibly the last one while there are more pages. That
    // day's net waits until the rest of its transactions are in.
    content = [
      ...days.map(({ day, transactions: rows }, index) => {
        const isPartialDay = index === days.length - 1 && list.hasNextPage;
        return (
          <ListGroup
            key={day}
            title={formatDay(day)}
            trailingTitle={isPartialDay ? undefined : netLabel(rows)}
          >
            {rows.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </ListGroup>
        );
      }),
      <ListFooter
        key="footer"
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
      />,
    ];
  }

  return (
    <>
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
        {content}
      </List>
    </>
  );
};
