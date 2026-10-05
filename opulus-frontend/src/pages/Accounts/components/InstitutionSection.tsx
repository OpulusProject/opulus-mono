import type { Account, ItemPublicDTO } from '@opulus/core';
import { ChevronRight } from 'lucide-react';
import React, { useState } from 'react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/date';
import { getInstitutionLogo } from '@/utils/institution';
import { getItemStatus } from '@/utils/itemStatus';

import { AccountRow } from './AccountRow';

interface InstitutionSectionProps {
  item: ItemPublicDTO;
  /** Accounts to show, already filtered and sorted by the page. */
  accounts: Account[];
}

export const InstitutionSection: React.FC<InstitutionSectionProps> = ({
  item,
  accounts,
}) => {
  const [open, setOpen] = useState(true);
  const status = getItemStatus(item.errorCode);
  const name = item.institutionName || 'Unknown Institution';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="rounded-md border">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
          >
            <Avatar className="size-8 shrink-0 rounded-[8px]">
              <AvatarImage
                src={getInstitutionLogo(item) ?? undefined}
                alt={name}
              />
              <AvatarFallback className="rounded-[8px] text-xs">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{name}</div>
              <div className="text-muted-foreground truncate text-xs">
                {accounts.length !== item.accounts.length &&
                  `${accounts.length} of `}
                {item.accounts.length} account
                {item.accounts.length === 1 ? '' : 's'}
                {item.syncedAt &&
                  ` · Last synced ${formatRelativeTime(item.syncedAt)}`}
              </div>
            </div>

            {status.inlineText && (
              <span
                className={cn(
                  'hidden max-w-[12rem] truncate text-xs font-medium sm:block',
                  status.variant === 'degraded' &&
                    'text-amber-600 dark:text-amber-400',
                  status.variant === 'offline' && 'text-destructive',
                  status.variant === 'unknown' && 'text-muted-foreground'
                )}
              >
                {status.inlineText}
              </span>
            )}

            <ChevronRight
              className={cn(
                'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
                open && 'rotate-90'
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
          <div className="divide-y border-t">
            {accounts.length === 0 ? (
              <p className="text-muted-foreground px-4 py-3 text-sm">
                No accounts found for this institution.
              </p>
            ) : (
              accounts.map((account) => (
                <AccountRow key={account.id} account={account} />
              ))
            )}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
};
