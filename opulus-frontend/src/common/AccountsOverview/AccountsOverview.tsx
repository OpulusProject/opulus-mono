import type { AccountType, AccountWithConnectionDTO } from '@opulus/core/dto';
import { Link } from '@tanstack/react-router';
import { Landmark } from 'lucide-react';
import { useMemo } from 'react';

import { List, ListEmpty, ListGroup } from '@/common/List';
import { Page } from '@/common/Page';
import { Button } from '@/components/ui';
import { useAccounts } from '@/hooks/accounts/useAccounts';
import { useAccountsSummary } from '@/hooks/accounts/useAccountsSummary';

import { AccountRow } from './AccountRow';
import { type AccountsSummary, formatBalance, typeSummary } from './summary';
import { type SummaryStat, SummaryStats } from './SummaryStats';

const byName = (a: AccountWithConnectionDTO, b: AccountWithConnectionDTO) =>
  a.name.localeCompare(b.name);

export interface AccountGroupConfig {
  type: AccountType;
  title: string;
}

interface AccountsOverviewProps {
  heading: string;
  description: string;
  /** Groups to show, in order. Their types define which accounts belong here. */
  groups: AccountGroupConfig[];
  /**
   * Headline numbers for every account on this page, from the server's summary.
   * Without it the page shows only its groups.
   */
  getSummary?: (summary: AccountsSummary) => SummaryStat[];
  emptyTitle: string;
  emptyDescription: string;
}

/**
 * Shared layout for pages that list accounts by type: a summary header, then
 * collapsible groups of accounts.
 */
export const AccountsOverview: React.FC<AccountsOverviewProps> = ({
  heading,
  description,
  groups,
  getSummary,
  emptyTitle,
  emptyDescription,
}) => {
  return (
    <Page
      title={heading}
      description={description}
      requiresConnections={{ title: emptyTitle, description: emptyDescription }}
    >
      <AccountGroups
        heading={heading}
        groups={groups}
        getSummary={getSummary}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
    </Page>
  );
};

// Its own component so that its query waits until the page knows something is
// connected.
const AccountGroups: React.FC<Omit<AccountsOverviewProps, 'description'>> = ({
  heading,
  groups,
  getSummary,
  emptyTitle,
  emptyDescription,
}) => {
  const types = useMemo(() => groups.map((group) => group.type), [groups]);
  const { data, isLoading } = useAccounts(types);
  const summary = useAccountsSummary(types).data;
  const accounts = useMemo(() => data?.accounts ?? [], [data]);

  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          accounts: accounts
            .filter((account) => account.type === group.type)
            .sort(byName),
        }))
        .filter((group) => group.accounts.length > 0),
    [accounts, groups]
  );

  if (isLoading) {
    return <List isLoading />;
  }
  if (accounts.length === 0) {
    return (
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
  }
  return (
    <>
      {summary && getSummary && <SummaryStats stats={getSummary(summary)} />}

      <List aria-label={heading}>
        {visibleGroups.map((group) => (
          <ListGroup
            key={group.type}
            title={group.title}
            trailingTitle={
              summary &&
              formatBalance(
                summary,
                typeSummary(summary, group.type)?.balance ?? 0
              )
            }
          >
            {group.accounts.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </ListGroup>
        ))}
      </List>
    </>
  );
};
