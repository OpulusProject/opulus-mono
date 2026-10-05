import type { Account } from '@opulus/core';
import React from 'react';

import {
  formatMoney,
  getAccountTypeLabel,
  getBalanceCaption,
} from '@/utils/accountDisplay';

interface AccountRowProps {
  account: Account;
}

export const AccountRow: React.FC<AccountRowProps> = ({ account }) => {
  const caption = getBalanceCaption(account);

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div
          className="truncate text-sm font-medium"
          title={account.officialName ?? undefined}
        >
          {account.name}
        </div>
        <div className="text-muted-foreground truncate text-xs">
          {getAccountTypeLabel(account)}
          {account.mask && ` · •••• ${account.mask}`}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-sm font-medium tabular-nums">
          {formatMoney(account.balanceCurrent, account.isoCurrencyCode)}
        </div>
        {caption && (
          <div className="text-muted-foreground text-xs tabular-nums">
            {caption}
          </div>
        )}
      </div>
    </div>
  );
};
