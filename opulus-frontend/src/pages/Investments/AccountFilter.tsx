import * as React from 'react';

import { AccountFilter as AccountsMenu } from '@/common/AccountFilter';
import { useHoldings } from '@/hooks/investments/useHoldings';

interface AccountFilterProps {
  /** The accounts the page is limited to (our account ids); none is all of them. */
  selected: string[];
  onChange: (selected: string[]) => void;
}

/** The account filter over the user's investment accounts. */
export const AccountFilter: React.FC<AccountFilterProps> = (props) => (
  // All the accounts, not just those in view, so the choices do not shrink.
  <AccountsMenu accounts={useHoldings().data?.accounts ?? []} {...props} />
);
