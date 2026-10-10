import { Link } from '@tanstack/react-router';
import { ReceiptText } from 'lucide-react';
import * as React from 'react';

import { ListEmpty } from '@/common/List';
import { Button } from '@/components/ui';

interface TransactionsEmptyProps {
  /** The current search; when set, the list is empty because nothing matched. */
  query: string;
  /** Whether anything is connected; `unknown` until that has loaded. */
  connections: 'some' | 'none' | 'unknown';
  onClearSearch: () => void;
}

/** Why there are no transactions, and what to do about it. */
export const TransactionsEmpty: React.FC<TransactionsEmptyProps> = ({
  query,
  connections,
  onClearSearch,
}) => {
  if (query) {
    return (
      <ListEmpty
        icon={ReceiptText}
        title="No transactions found"
        description={`Nothing matches "${query}".`}
        action={
          <Button variant="outline" onClick={onClearSearch}>
            Clear search
          </Button>
        }
      />
    );
  }
  if (connections === 'none') {
    return (
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
  }
  return (
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
};
