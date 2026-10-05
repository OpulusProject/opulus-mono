import type { Account, ItemPublicDTO } from '@opulus/core';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AppLayout } from '@/common/AppLayout';
import { PageHeader } from '@/common/PageHeader';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@/components/ui';
import { useItems } from '@/hooks/items/useItems';
import { getAccountTypeLabel } from '@/utils/accountDisplay';

import { EmptyAccountsView, InstitutionSection } from './components';

type SortKey = 'name' | 'balance' | 'type';

const SORTERS: Record<SortKey, (a: Account, b: Account) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  // Highest balance first; accounts without a balance go last.
  balance: (a, b) =>
    (b.balanceCurrent ?? -Infinity) - (a.balanceCurrent ?? -Infinity),
  type: (a, b) =>
    getAccountTypeLabel(a).localeCompare(getAccountTypeLabel(b)) ||
    a.name.localeCompare(b.name),
};

function accountMatches(account: Account, query: string): boolean {
  return [account.name, account.officialName, account.mask].some((field) =>
    field?.toLowerCase().includes(query)
  );
}

function institutionMatches(item: ItemPublicDTO, query: string): boolean {
  return !!item.institutionName?.toLowerCase().includes(query);
}

export const Accounts: React.FC = () => {
  const { data: itemsData, isLoading } = useItems();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  const items = useMemo(() => itemsData?.items ?? [], [itemsData]);
  const totalAccounts = items.reduce((sum, i) => sum + i.accounts.length, 0);

  const query = search.trim().toLowerCase();
  const isSearching = query.length > 0;

  const sections = useMemo(() => {
    return items
      .map((item) => {
        // A matching institution name shows all of its accounts.
        const accounts =
          !query || institutionMatches(item, query)
            ? item.accounts
            : item.accounts.filter((account) => accountMatches(account, query));
        return { item, accounts: [...accounts].sort(SORTERS[sortKey]) };
      })
      .filter(({ accounts }) => !query || accounts.length > 0);
  }, [items, query, sortKey]);

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  } else if (totalAccounts === 0) {
    content = <EmptyAccountsView />;
  } else {
    content = (
      <>
        <div className="flex items-center gap-4">
          <InputGroup className="flex-1">
            <InputGroupAddon>
              <Search className="h-4 w-4" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search accounts..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </InputGroup>
          <Select
            value={sortKey}
            onValueChange={(value) => setSortKey(value as SortKey)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="balance">Balance</SelectItem>
              <SelectItem value="type">Type</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {sections.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No accounts match &ldquo;{search.trim()}&rdquo;.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {sections.map(({ item, accounts }) => (
              <InstitutionSection
                // Remount (expanded) when a search starts so matches are visible.
                key={`${item.id}:${isSearching}`}
                item={item}
                accounts={accounts}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <AppLayout title="Accounts">
      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <PageHeader
          title="Your accounts"
          description="Balances and details for every account across your connections."
        />
        {content}
      </div>
    </AppLayout>
  );
};
