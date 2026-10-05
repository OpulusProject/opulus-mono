import { ChevronRight } from 'lucide-react';
import React, { useState } from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatTotals } from '@/utils/accountDisplay';

import type { AccountEntry } from './accountEntries';
import { AccountRow } from './AccountRow';

interface AccountGroupProps {
  title: string;
  entries: AccountEntry[];
}

export const AccountGroup: React.FC<AccountGroupProps> = ({
  title,
  entries,
}) => {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="rounded-md border">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{title}</div>
              <div className="text-muted-foreground text-xs">
                {entries.length} account{entries.length === 1 ? '' : 's'}
              </div>
            </div>
            <span className="text-sm font-medium tabular-nums">
              {formatTotals(entries.map((e) => e.account))}
            </span>
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
            {entries.map((entry) => (
              <AccountRow key={entry.account.id} entry={entry} />
            ))}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
};
