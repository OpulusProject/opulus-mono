import React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  formatMoney,
  getAccountTypeLabel,
  getBalanceCaption,
} from '@/utils/accountDisplay';
import { getInstitutionLogo } from '@/utils/institution';
import { getItemStatus } from '@/utils/itemStatus';

import type { AccountEntry } from './accountEntries';

interface AccountRowProps {
  entry: AccountEntry;
}

export const AccountRow: React.FC<AccountRowProps> = ({ entry }) => {
  const { account, item } = entry;
  const caption = getBalanceCaption(account);
  const institution = item.institutionName || 'Unknown institution';
  const status = getItemStatus(item.errorCode);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar className="size-8 shrink-0 rounded-[8px]">
        <AvatarImage src={getInstitutionLogo(item) ?? undefined} alt="" />
        <AvatarFallback className="rounded-[8px] text-xs">
          {institution.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div
          className="truncate text-sm font-medium"
          title={account.officialName ?? undefined}
        >
          {account.name}
        </div>
        <div className="text-muted-foreground truncate text-xs">
          {institution}
          {` · ${getAccountTypeLabel(account)}`}
          {account.mask && ` •••• ${account.mask}`}
          {status.inlineText && (
            <span
              className={cn(
                'ml-2 font-medium',
                status.variant === 'degraded' &&
                  'text-amber-600 dark:text-amber-400',
                status.variant === 'offline' && 'text-destructive'
              )}
            >
              {status.inlineText}
            </span>
          )}
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
