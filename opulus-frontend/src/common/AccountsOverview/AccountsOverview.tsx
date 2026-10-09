import type { AccountType, AccountWithConnectionDTO } from '@opulus/core/dto';
import { Link } from '@tanstack/react-router';
import { Landmark } from 'lucide-react';
import { useMemo } from 'react';

import { AppLayout } from '@/common/AppLayout';
import { List, ListEmpty, ListGroup } from '@/common/List';
import { PageHeader } from '@/common/PageHeader';
import { Button } from '@/components/ui';
import { useAccounts } from '@/hooks/accounts/useAccounts';
import { formatTotals } from '@/utils/accountDisplay';
import { getAccountType } from '@/utils/accountType';

import { AccountRow } from './AccountRow';
import { type SummaryStat, SummaryStats } from './SummaryStats';

const byName = (a: AccountWithConnectionDTO, b: AccountWithConnectionDTO) =>
  a.name.localeCompare(b.name);

const countLabel = (count: number) =>
  `${count} account${count === 1 ? '' : 's'}`;

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
    content = <List isLoading />;
  } else if (accounts.length === 0) {
    content = (
      <List>
        <ListEmpty
          icon={Landmark}
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Button asChild>
              <Link to="/settings/connections">Go to connections</Link>
            </Button>
          }
        />
      </List>
    );
  } else {
    content = (
      <>
        <SummaryStats stats={getSummary(accounts)} />

        <List aria-label={heading}>
          {visibleGroups.map((group) => (
            <ListGroup
              key={group.type}
              collapsible
              title={group.title}
              subtitle={countLabel(group.accounts.length)}
              trailingTitle={formatTotals(group.accounts)}
            >
              {group.accounts.map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
            </ListGroup>
          ))}
        </List>
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
