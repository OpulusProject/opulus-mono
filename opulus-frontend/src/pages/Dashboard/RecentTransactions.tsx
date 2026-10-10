import { Link } from '@tanstack/react-router';
import { ReceiptText } from 'lucide-react';
import * as React from 'react';

import { List, ListError, ListHeader } from '@/common/List';
import { TransactionRow } from '@/common/TransactionRow';
import { Button } from '@/components/ui';
import { useAccounts } from '@/hooks/accounts/useAccounts';
import { useTransactions } from '@/hooks/transactions/useTransactions';

import { DashboardEmpty } from './DashboardEmpty';

const COUNT = 5;

/** The latest few transactions, with a link to all of them. */
export const RecentTransactions: React.FC = () => {
  const transactions = useTransactions({
    sort: 'date',
    order: 'desc',
    limit: COUNT,
  });
  const accounts = useAccounts();
  const noConnections = accounts.data?.accounts.length === 0;
  const rows = transactions.data?.transactions ?? [];

  let content: React.ReactNode;
  if (transactions.isError) {
    content = (
      <ListError
        subject="transactions"
        onRetry={() => void transactions.refetch()}
      />
    );
  } else if (rows.length === 0) {
    content = (
      <DashboardEmpty
        icon={ReceiptText}
        noConnections={noConnections}
        title="No transactions yet"
        description="Transactions from your connected accounts will appear here once they finish syncing."
      />
    );
  } else {
    content = rows.map((transaction) => (
      <TransactionRow key={transaction.id} transaction={transaction} />
    ));
  }

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
      {content}
    </List>
  );
};
