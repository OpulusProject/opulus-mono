import type { BankAccountWithConnectionDTO } from '@opulus/core';
import React, { useState } from 'react';

import { ListRow } from '@/common/ListRow';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui';
import { formatTotals } from '@/utils/accountDisplay';

import { AccountRow } from './AccountRow';

interface AccountGroupProps {
  title: string;
  accounts: BankAccountWithConnectionDTO[];
}

export const AccountGroup: React.FC<AccountGroupProps> = ({
  title,
  accounts,
}) => {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="rounded-md border">
        <CollapsibleTrigger asChild>
          <ListRow
            title={title}
            subtitle={`${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
            trailingTitle={formatTotals(accounts)}
            expanded={open}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
          <div className="divide-y border-t">
            {accounts.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
};
