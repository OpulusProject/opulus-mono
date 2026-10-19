import { Link } from '@tanstack/react-router';
import { Landmark } from 'lucide-react';
import * as React from 'react';

import { List, ListEmpty, ListError } from '@/common/List';
import { Page } from '@/common/Page';
import { Button } from '@/components/ui';
import { useHoldings } from '@/hooks/investments/useHoldings';

import { AccountsAndGains } from './AccountsAndGains';
import { PortfolioSummary } from './PortfolioSummary';

/** What the user's investments are worth and made of, and how they have done. */
export const Investments: React.FC = () => (
  <Page
    title="Investments"
    description="What you own across your investment accounts."
    requiresConnections={{
      title: 'No investment accounts yet',
      description:
        'Connect a brokerage, TFSA, RRSP or other investment account and Opulus shows what you hold and what it is worth.',
    }}
  >
    <InvestmentsContent />
  </Page>
);

// Its own component so that its queries wait until the page knows something is
// connected.
const InvestmentsContent: React.FC = () => {
  const holdings = useHoldings();

  if (holdings.isLoading) return <List isLoading aria-label="Loading" />;
  if (holdings.isError || !holdings.data) {
    return (
      <List>
        <ListError
          subject="your investments"
          onRetry={() => void holdings.refetch()}
        />
      </List>
    );
  }
  // Connected, but with no investment account: say so, and where cash lives.
  if (holdings.data.accounts.length === 0) {
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

  return (
    <>
      <PortfolioSummary data={holdings.data} />
      <AccountsAndGains data={holdings.data} />
    </>
  );
};
