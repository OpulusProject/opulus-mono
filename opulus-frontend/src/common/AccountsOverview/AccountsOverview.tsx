import type { AccountType, AccountWithConnectionDTO } from '@opulus/core';
import { useMemo } from 'react';

import { AppLayout } from '@/common/AppLayout';
import { PageHeader } from '@/common/PageHeader';
import { Spinner } from '@/components/ui';
import { useAccounts } from '@/hooks/accounts/useAccounts';
import { getAccountType } from '@/utils/accountType';

import { AccountGroup } from './AccountGroup';
import { EmptyAccountsView } from './EmptyAccountsView';
import { type SummaryStat, SummaryStats } from './SummaryStats';

const byName = (a: AccountWithConnectionDTO, b: AccountWithConnectionDTO) =>
  a.name.localeCompare(b.name);

export interface AccountGroupConfig {
  type: AccountType;
  title: string;
}

interface AccountsOverviewProps {
  /** Page title shown in the top bar. */
  title: string;
  heading: string;
  description: string;
  /** Groups to show, in order. Their types define which accounts belong here. */
  groups: AccountGroupConfig[];
  /** Headline numbers for every account on this page. */
  getSummary: (accounts: AccountWithConnectionDTO[]) => SummaryStat[];
  emptyTitle: string;
  emptyDescription: string;
}

/**
 * Shared layout for pages that list accounts by type: a summary header, then
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
  const types = useMemo(() => groups.map((group) => group.type), [groups]);
  const { data, isLoading } = useAccounts(types);
  const accounts = useMemo(() => data?.accounts ?? [], [data]);

  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          accounts: accounts
            .filter((account) => getAccountType(account) === group.type)
            .sort(byName),
        }))
        .filter((group) => group.accounts.length > 0),
    [accounts, groups]
  );

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  } else if (accounts.length === 0) {
    content = (
      <EmptyAccountsView title={emptyTitle} description={emptyDescription} />
    );
  } else {
    content = (
      <>
        <SummaryStats stats={getSummary(accounts)} />

        <div className="flex flex-col gap-4">
          {visibleGroups.map((group) => (
            <AccountGroup
              key={group.type}
              title={group.title}
              accounts={group.accounts}
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
