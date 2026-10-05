import { useMemo } from 'react';

import { AppLayout } from '@/common/AppLayout';
import { PageHeader } from '@/common/PageHeader';
import { Spinner } from '@/components/ui';
import { useItems } from '@/hooks/items/useItems';
import { type AccountKind, getAccountKind } from '@/utils/accountKind';

import { type AccountEntry, toAccountEntries } from './accountEntries';
import { AccountGroup } from './AccountGroup';
import { EmptyAccountsView } from './EmptyAccountsView';
import { type SummaryStat, SummaryStats } from './SummaryStats';

const byName = (a: AccountEntry, b: AccountEntry) =>
  a.account.name.localeCompare(b.account.name);

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
 * Shared layout for pages that list accounts by kind: a summary header, then
 * collapsible groups of accounts.
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
  const entries = useMemo(() => {
    const kinds = new Set(groups.map((group) => group.kind));
    return toAccountEntries(itemsData?.items ?? []).filter((entry) =>
      kinds.has(getAccountKind(entry.account))
    );
  }, [itemsData, groups]);

  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          entries: entries
            .filter((entry) => getAccountKind(entry.account) === group.kind)
            .sort(byName),
        }))
        .filter((group) => group.entries.length > 0),
    [entries, groups]
  );

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

        <div className="flex flex-col gap-4">
          {visibleGroups.map((group) => (
            <AccountGroup
              key={group.kind}
              title={group.title}
              entries={group.entries}
            />
          ))}
        </div>
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
