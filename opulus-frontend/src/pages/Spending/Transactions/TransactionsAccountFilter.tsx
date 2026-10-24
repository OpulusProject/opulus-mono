import * as React from 'react';

import { AccountFilter } from '@/common/AccountFilter';
import { useAccounts } from '@/hooks/accounts/useAccounts';

interface TransactionsAccountFilterProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

/**
 * The account filter over the accounts that have transactions (not
 * investments, whose activity is on its own pages).
 */
export const TransactionsAccountFilter: React.FC<
  TransactionsAccountFilterProps
> = (props) => (
  <AccountFilter
    accounts={
      useAccounts(['depository', 'credit', 'loan', 'other']).data?.accounts ??
      []
    }
    {...props}
  />
);
