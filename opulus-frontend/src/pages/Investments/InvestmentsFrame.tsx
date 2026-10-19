import { Link } from '@tanstack/react-router';
import { Landmark } from 'lucide-react';
import * as React from 'react';

import { List, ListEmpty } from '@/common/List';
import { Page } from '@/common/Page';
import { Button } from '@/components/ui';
import { useHoldings } from '@/hooks/investments/useHoldings';

interface InvestmentsFrameProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

/**
 * What the investments page is framed in: the heading, and the empty state for
 * a user with no investment accounts (their content is not rendered, so it
 * makes no requests).
 */
export const InvestmentsFrame: React.FC<InvestmentsFrameProps> = ({
  title,
  description,
  children,
}) => (
  <Page
    title={title}
    description={description}
    requiresConnections={{
      title: 'No investment accounts yet',
      description:
        'Connect a brokerage, TFSA, RRSP or other investment account and Opulus shows what you hold and what it is worth.',
    }}
  >
    <NoAccountsGate>{children}</NoAccountsGate>
  </Page>
);

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
