import type { AccountWithConnectionDTO } from '@opulus/core/dto';
import React from 'react';

import { ListRow } from '@/common/List';
import {
  formatMoney,
  getAccountTypeLabel,
  getBalanceCaption,
} from '@/utils/accountDisplay';
import { getStatusNotice } from '@/utils/itemStatus';

interface AccountRowProps {
  account: AccountWithConnectionDTO;
}

export const AccountRow: React.FC<AccountRowProps> = ({ account }) => {
  const notice = getStatusNotice(account.connection.errorCode);

  return (
    <ListRow
      title={account.name}
      subtitle={`${account.connection.institutionName || 'Unknown institution'} · ${getAccountTypeLabel(account)}${account.mask ? ` •••• ${account.mask}` : ''}`}
      notices={notice ? [notice] : undefined}
      trailingTitle={formatMoney(
        account.balanceCurrent,
        account.isoCurrencyCode
      )}
      trailingSubtitle={getBalanceCaption(account) ?? undefined}
    />
  );
};
