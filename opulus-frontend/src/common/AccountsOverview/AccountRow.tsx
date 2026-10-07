import React from 'react';

import { ListRow } from '@/common/ListRow';
import {
  formatMoney,
  getAccountTypeLabel,
  getBalanceCaption,
} from '@/utils/accountDisplay';
import { getStatusNotice } from '@/utils/itemStatus';

import type { AccountEntry } from './accountEntries';

interface AccountRowProps {
  entry: AccountEntry;
}

export const AccountRow: React.FC<AccountRowProps> = ({ entry }) => {
  const { account, item } = entry;
  const notice = getStatusNotice(item.errorCode);

  return (
    <ListRow
      title={account.name}
      subtitle={`${item.institutionName || 'Unknown institution'} · ${getAccountTypeLabel(account)}${account.mask ? ` •••• ${account.mask}` : ''}`}
      notices={notice ? [notice] : undefined}
      trailingTitle={formatMoney(
        account.balanceCurrent,
        account.isoCurrencyCode
      )}
      trailingSubtitle={getBalanceCaption(account) ?? undefined}
    />
  );
};
