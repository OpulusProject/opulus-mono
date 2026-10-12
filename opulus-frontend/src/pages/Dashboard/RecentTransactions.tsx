import { Link } from '@tanstack/react-router';
import { ReceiptText } from 'lucide-react';
import * as React from 'react';

import { List, ListEmpty, ListError, ListHeader } from '@/common/List';
import { TransactionRow } from '@/common/TransactionRow';
import { Button } from '@/components/ui';
import { useTransactions } from '@/hooks/transactions/useTransactions';

const COUNT = 5;

/** The latest few transactions, with a link to all of them. */
export const RecentTransactions: React.FC = () => {
  const transactions = useTransactions({
    sort: 'date',
    order: 'desc',
    limit: COUNT,
  });
  const rows = transactions.data?.transactions ?? [];

  return (
    <List aria-label="Recent transactions" isLoading={transactions.isLoading}>
      <ListHeader
        title="Recent transactions"
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/transactions">View all</Link>
          </Button>
        }
      />
      {transactions.isError ? (
        <ListError
          subject="transactions"
          onRetry={() => void transactions.refetch()}
        />
      ) : rows.length === 0 ? (
        <ListEmpty
          icon={ReceiptText}
          title="No transactions yet"
          description="Transactions from your connected accounts will appear here once they finish syncing."
        />
      ) : (
        rows.map((transaction) => (
          <TransactionRow key={transaction.id} transaction={transaction} />
        ))
      )}
    </List>
  );
};
