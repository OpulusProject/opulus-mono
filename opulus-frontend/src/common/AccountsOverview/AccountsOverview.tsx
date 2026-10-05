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
import { type AccountKind, getAccountKind } from '@/utils/accountKind';

import { type AccountEntry, toAccountEntries } from './accountEntries';
import { AccountGroup } from './AccountGroup';
import { EmptyAccountsView } from './EmptyAccountsView';
import { type SummaryStat, SummaryStats } from './SummaryStats';

type SortKey = 'name' | 'balance' | 'type';

const SORTERS: Record<SortKey, (a: AccountEntry, b: AccountEntry) => number> = {
  name: (a, b) => a.account.name.localeCompare(b.account.name),
  // Largest balance first; accounts without a balance go last.
  balance: (a, b) =>
    (b.account.balanceCurrent ?? -Infinity) -
    (a.account.balanceCurrent ?? -Infinity),
  type: (a, b) =>
    getAccountTypeLabel(a.account).localeCompare(
      getAccountTypeLabel(b.account)
    ) || a.account.name.localeCompare(b.account.name),
};

function matchesQuery({ account, item }: AccountEntry, query: string) {
  return [
    account.name,
    account.officialName,
    account.mask,
    item.institutionName,
  ].some((field) => field?.toLowerCase().includes(query));
}

export interface AccountGroupConfig {
  kind: AccountKind;
  title: string;
}

interface AccountsOverviewProps {
  /** Page title shown in the top bar. */
  title: string;
  heading: string;
  description: string;
  /** Groups to show, in order. Their kinds define which accounts belong here. */
  groups: AccountGroupConfig[];
  /** Headline numbers for every account on this page (ignores search). */
  getSummary: (entries: AccountEntry[]) => SummaryStat[];
  emptyTitle: string;
  emptyDescription: string;
}

/**
 * Shared layout for pages that list accounts by kind: summary header, search
 * and sort, then collapsible groups of accounts.
 */
export const AccountsOverview: React.FC<AccountsOverviewProps> = ({
  title,
  heading,
  description,
  groups,
  getSummary,
  emptyTitle,
  emptyDescription,
}) => {
  const { data: itemsData, isLoading } = useItems();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  const entries = useMemo(() => {
    const kinds = new Set(groups.map((group) => group.kind));
    return toAccountEntries(itemsData?.items ?? []).filter((entry) =>
      kinds.has(getAccountKind(entry.account))
    );
  }, [itemsData, groups]);

  const query = search.trim().toLowerCase();
  const isSearching = query.length > 0;

  const visibleGroups = useMemo(() => {
    const matching = isSearching
      ? entries.filter((entry) => matchesQuery(entry, query))
      : entries;
    return groups
      .map((group) => ({
        ...group,
        entries: matching
          .filter((entry) => getAccountKind(entry.account) === group.kind)
          .sort(SORTERS[sortKey]),
      }))
      .filter((group) => group.entries.length > 0);
  }, [entries, groups, query, isSearching, sortKey]);

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  } else if (entries.length === 0) {
    content = (
      <EmptyAccountsView title={emptyTitle} description={emptyDescription} />
    );
  } else {
    content = (
      <>
        <SummaryStats stats={getSummary(entries)} />

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

        {visibleGroups.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No accounts match &ldquo;{search.trim()}&rdquo;.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleGroups.map((group) => (
              <AccountGroup
                // Remount (expanded) when a search starts so matches are visible.
                key={`${group.kind}:${isSearching}`}
                title={group.title}
                entries={group.entries}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <AppLayout title={title}>
      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <PageHeader title={heading} description={description} />
        {content}
      </div>
    </AppLayout>
  );
};
