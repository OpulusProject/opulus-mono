import { Link } from '@tanstack/react-router';
import { CircleAlert, ReceiptText } from 'lucide-react';
import { useMemo } from 'react';

import { AppLayout } from '@/common/AppLayout';
import { List, ListEmpty, ListFooter, ListGroup } from '@/common/List';
import { PageHeader } from '@/common/PageHeader';
import { Button, Spinner } from '@/components/ui';
import { useItems } from '@/hooks/items/useItems';
import { useInfiniteTransactions } from '@/hooks/transactions/useInfiniteTransactions';
import { formatDay } from '@/utils/day';

import { groupByDay, spentLabel } from './transactionDays';
import { TransactionRow } from './TransactionRow';
import { TransactionSearch } from './TransactionSearch';
import { useTransactionFilters } from './useTransactionFilters';

export const Transactions: React.FC = () => {
  const { query, filters, setQuery } = useTransactionFilters();

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

  let content: React.ReactNode;
  if (list.isError) {
    content = (
      <ListEmpty
        icon={CircleAlert}
        title="Couldn't load transactions"
        description="Something went wrong. Try again."
        action={
          <Button variant="outline" onClick={() => void list.refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else if (transactions.length === 0) {
    if (query) {
      content = (
        <ListEmpty
          icon={ReceiptText}
          title="No transactions found"
          description={`Nothing matches "${query}".`}
          action={
            <Button variant="outline" onClick={() => setQuery('')}>
              Clear search
            </Button>
          }
        />
      );
    } else if (connections === 'none') {
      content = (
        <ListEmpty
          icon={ReceiptText}
          title="No connections yet"
          description="Connect an account to see your transactions here."
          action={
            <Button asChild>
              <Link to="/settings/connections">Go to connections</Link>
            </Button>
          }
        />
      );
    } else {
      content = (
        <ListEmpty
          icon={ReceiptText}
          title="No transactions yet"
          description={
            connections === 'some'
              ? 'Transactions from your connected accounts will appear here once they finish syncing.'
              : undefined
          }
        />
      );
    }
  } else {
    // The pages are an unbroken run from the newest transaction, so every day is
    // complete except possibly the last one while there are more pages. That
    // day's total waits until the rest of its transactions are in.
    content = [
      ...days.map(({ day, transactions: rows }, index) => {
        const isPartialDay = index === days.length - 1 && list.hasNextPage;
        const spent = isPartialDay ? null : spentLabel(rows);
        return (
          <ListGroup
            key={day}
            title={formatDay(day)}
            trailingTitle={spent ? `Spent ${spent}` : undefined}
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
    <AppLayout title="Transactions">
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
          {content}
        </List>
      </div>
    </AppLayout>
  );
};
