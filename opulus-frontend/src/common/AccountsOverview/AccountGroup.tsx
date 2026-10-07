import React, { useState } from 'react';

import { ListRow } from '@/common/ListRow';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui';
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
          <ListRow
            title={title}
            subtitle={`${entries.length} account${entries.length === 1 ? '' : 's'}`}
            trailingTitle={formatTotals(entries.map((e) => e.account))}
            expanded={open}
          />
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
