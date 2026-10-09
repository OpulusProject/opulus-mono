import { Link } from '@tanstack/react-router';
import { ReceiptText } from 'lucide-react';
import * as React from 'react';

import { ListEmpty } from '@/common/List';
import { Button } from '@/components/ui';

interface TransactionsEmptyProps {
  /** A search or filter is set, so the list is empty because nothing matched. */
  isFiltered: boolean;
  /** Whether anything is connected; `unknown` until that has loaded. */
  connections: 'some' | 'none' | 'unknown';
  onClearFilters: () => void;
}

/** Why there are no transactions, and what to do about it. */
export const TransactionsEmpty: React.FC<TransactionsEmptyProps> = ({
  isFiltered,
  connections,
  onClearFilters,
}) => {
  if (isFiltered) {
    return (
      <ListEmpty
        icon={ReceiptText}
        title="No transactions found"
        description="Nothing matches. Try a different search or fewer filters."
        action={
          <Button variant="outline" onClick={onClearFilters}>
            Clear search and filters
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
