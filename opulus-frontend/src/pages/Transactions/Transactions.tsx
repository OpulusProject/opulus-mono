import { AppLayout } from '@/common/AppLayout';
import { PageHeader } from '@/common/PageHeader';
import {
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Skeleton,
} from '@/components/ui';
import { useInfiniteTransactions } from '@/hooks/transactions/useInfiniteTransactions';
import { cn } from '@/lib/utils';

import { TransactionList } from './TransactionList';
import { TransactionSearch } from './TransactionSearch';
import { useTransactionFilters } from './useTransactionFilters';

export const Transactions: React.FC = () => {
  const { query, filters, setQuery } = useTransactionFilters();

  const list = useInfiniteTransactions(filters);

  const transactions =
    list.data?.pages.flatMap((page) => page.transactions) ?? [];
  const total = list.data?.pages[0]?.pagination.total ?? 0;

  let content: React.ReactNode;
  if (list.isError) {
    content = (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Couldn&apos;t load transactions</EmptyTitle>
          <EmptyDescription>Something went wrong. Try again.</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={() => void list.refetch()}>
          Try again
        </Button>
      </Empty>
    );
  } else if (list.isLoading) {
    content = (
      <div className="flex flex-col gap-3 p-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 rounded-md" />
        ))}
      </div>
    );
  } else if (transactions.length === 0) {
    content = (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No transactions found</EmptyTitle>
          <EmptyDescription>
            {query
              ? `Nothing matches "${query}".`
              : 'Connect an account to see your transactions here.'}
          </EmptyDescription>
        </EmptyHeader>
        {query && (
          <Button variant="outline" onClick={() => setQuery('')}>
            Clear search
          </Button>
        )}
      </Empty>
    );
  } else {
    content = (
      <TransactionList
        transactions={transactions}
        total={total}
        hasMore={list.hasNextPage}
        isLoadingMore={list.isFetchingNextPage}
        onLoadMore={() => void list.fetchNextPage()}
      />
    );
  }

  return (
    <AppLayout title="Transactions">
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <PageHeader
          title="Transactions"
          description="Search everything you've spent and received."
        />
        <TransactionSearch value={query} onChange={setQuery} />

        {/* The previous results stay up while new ones load; dim them. */}
        <div
          className={cn(
            'divide-y rounded-md border',
            list.isPlaceholderData && 'opacity-60 transition-opacity'
          )}
        >
          {content}
        </div>
      </div>
    </AppLayout>
  );
};
