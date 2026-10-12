import { ReceiptText } from 'lucide-react';
import * as React from 'react';

import { ListEmpty } from '@/common/List';

interface TransactionsEmptyProps {
  /** A search or filter is set, so the list is empty because nothing matched. */
  isFiltered: boolean;
}

/** Why there are no transactions (something is connected, or the page would not show). */
export const TransactionsEmpty: React.FC<TransactionsEmptyProps> = ({
  isFiltered,
}) => {
  if (isFiltered) {
    return (
      <ListEmpty
        icon={ReceiptText}
        title="No transactions found"
        description="Nothing matches. Try a different search or fewer filters."
      />
    );
  }
  return (
    <ListEmpty
      icon={ReceiptText}
      title="No transactions yet"
      description="Transactions from your connected accounts will appear here once they finish syncing."
    />
  );
};
