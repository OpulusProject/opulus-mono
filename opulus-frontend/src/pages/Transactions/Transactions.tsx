import { useMemo } from 'react';

import {
  List,
  ListError,
  ListFooter,
  ListGroup,
  ListHeader,
} from '@/common/List';
import { PageHeader } from '@/common/PageHeader';
import { Button, Spinner } from '@/components/ui';
import { useItems } from '@/hooks/items/useItems';
import { useInfiniteTransactions } from '@/hooks/transactions/useInfiniteTransactions';
import { useOnVisible } from '@/hooks/use-on-visible';
import { formatDay } from '@/utils/day';

import { groupByDay, netLabel } from './transactionDays';
import { TransactionFilters } from './TransactionFilters';
import { TransactionRow } from './TransactionRow';
import { TransactionSearch } from './TransactionSearch';
import { TransactionsEmpty } from './TransactionsEmpty';
import { useTransactionFilters } from './useTransactionFilters';

export const Transactions: React.FC = () => {
  const { search, filters, update, hasFilters, clearFilters, isFiltered } =
    useTransactionFilters();
  const query = search.q ?? '';
  const setQuery = (q: string) => update({ q });

  const list = useInfiniteTransactions(filters);
  const items = useItems();
  // What an empty list means depends on whether anything is connected; until
  // that is known (or if it failed to load) the empty state does not guess.
  const connections = items.data
    ? items.data.items.length > 0
      ? 'some'
      : 'none'
    : 'unknown';

  const transactions = useMemo(
    () => list.data?.pages.flatMap((page) => page.transactions) ?? [],
    [list.data]
  );
  const days = useMemo(() => groupByDay(transactions), [transactions]);
  const total = list.data?.pages[0]?.pagination.total ?? 0;

  // Reaching the end of the list loads the next page. The "Load more" button
  // is what is watched, and stays as the way to retry after a failed load.
  const loadMoreRef = useOnVisible<HTMLButtonElement>(
    () => void list.fetchNextPage(),
    {
      enabled:
        list.hasNextPage &&
        !list.isFetchingNextPage &&
        !list.isFetchNextPageError,
      rootMargin: '300px',
    }
  );

  let content: React.ReactNode;
  if (list.isError) {
    content = (
      <ListError subject="transactions" onRetry={() => void list.refetch()} />
    );
  } else if (transactions.length === 0) {
    content = (
      <TransactionsEmpty isFiltered={isFiltered} connections={connections} />
    );
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
          list.hasNextPage ? (
            <Button
              ref={loadMoreRef}
              variant="outline"
              size="sm"
              onClick={() => void list.fetchNextPage()}
              disabled={list.isFetchingNextPage}
            >
              {list.isFetchingNextPage && <Spinner />}
              Load more
            </Button>
          ) : undefined
        }
      />,
    ];
  }

  return (
    <>
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <PageHeader
          title="Transactions"
          description="Search everything you've spent and received."
        />
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
      </div>
    </>
  );
};
