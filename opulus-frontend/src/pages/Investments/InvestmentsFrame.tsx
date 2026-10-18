import { Link } from '@tanstack/react-router';
import { Landmark } from 'lucide-react';
import * as React from 'react';

import { List, ListEmpty } from '@/common/List';
import { Page } from '@/common/Page';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { useHoldings } from '@/hooks/investments/useHoldings';
import { cn } from '@/lib/utils';
import { accountName } from '@/utils/investmentDisplay';

const ALL_ACCOUNTS = 'all';

interface InvestmentsFrameProps {
  description: string;
  active: 'overview' | 'holdings' | 'activity';
  /** The account the page is limited to (our account id), if any. */
  account: string | undefined;
  onAccountChange: (account: string | undefined) => void;
  children: React.ReactNode;
}

/**
 * What the investments pages share: the heading, the Overview / Holdings / Activity tabs,
 * the account filter, and the empty state for a user with no investment
 * accounts (their content is not rendered, so it makes no requests).
 */
export const InvestmentsFrame: React.FC<InvestmentsFrameProps> = ({
  description,
  active,
  account,
  onAccountChange,
  children,
}) => (
  <Page
    title="Investments"
    description={description}
    requiresConnections={{
      title: 'No investment accounts yet',
      description:
        'Connect a brokerage, TFSA, RRSP or other investment account and Opulus shows what you hold and what it is worth.',
    }}
    actions={
      <>
        <Tabs active={active} account={account} />
        <AccountFilter account={account} onChange={onAccountChange} />
      </>
    }
  >
    <NoAccountsGate>{children}</NoAccountsGate>
  </Page>
);

const TAB_CLASS =
  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors';

const Tabs: React.FC<{
  active: InvestmentsFrameProps['active'];
  account: string | undefined;
}> = ({ active, account }) => (
  <nav aria-label="Investments" className="bg-muted flex rounded-lg p-0.5">
    <Link
      to="/investments"
      search={{ account }}
      aria-current={active === 'overview' ? 'page' : undefined}
      className={cn(
        TAB_CLASS,
        active === 'overview'
          ? 'bg-background shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      Overview
    </Link>
    <Link
      to="/investments/holdings"
      search={{ account }}
      aria-current={active === 'holdings' ? 'page' : undefined}
      className={cn(
        TAB_CLASS,
        active === 'holdings'
          ? 'bg-background shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      Holdings
    </Link>
    <Link
      to="/investments/activity"
      search={{ account }}
      aria-current={active === 'activity' ? 'page' : undefined}
      className={cn(
        TAB_CLASS,
        active === 'activity'
          ? 'bg-background shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      Activity
    </Link>
  </nav>
);

const AccountFilter: React.FC<{
  account: string | undefined;
  onChange: (account: string | undefined) => void;
}> = ({ account, onChange }) => {
  const accounts = useHoldings().data?.accounts ?? [];
  if (accounts.length < 2) return null;

  return (
    <Select
      value={account ?? ALL_ACCOUNTS}
      onValueChange={(value) =>
        onChange(value === ALL_ACCOUNTS ? undefined : value)
      }
    >
      <SelectTrigger size="sm" className="w-44" aria-label="Account">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_ACCOUNTS}>All accounts</SelectItem>
        {accounts.map((entry) => (
          <SelectItem key={entry.id} value={entry.id}>
            {accountName(entry)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// Connected but with no investment account: say so, and where cash lives.
const NoAccountsGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const holdings = useHoldings();
  if (holdings.isLoading) return <List isLoading aria-label="Loading" />;
  if (holdings.data && holdings.data.accounts.length === 0) {
    return (
      <List>
        <ListEmpty
          icon={Landmark}
          title="No investment accounts yet"
          description="Connect a brokerage, TFSA, RRSP or other investment account and Opulus shows what you hold and what it is worth. Your cash accounts are on the Accounts page."
          action={
            <Button asChild>
              <Link to="/settings/connections">Go to connections</Link>
            </Button>
          }
        />
      </List>
    );
  }
  return <>{children}</>;
};
