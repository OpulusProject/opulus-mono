import { Link, getRouteApi } from '@tanstack/react-router';
import { Landmark } from 'lucide-react';
import * as React from 'react';

import { List, ListEmpty, ListError } from '@/common/List';
import { Page } from '@/common/Page';
import { Button } from '@/components/ui';
import { useHoldings } from '@/hooks/investments/useHoldings';

import { AccountFilter } from './AccountFilter';
import { ByAccountList } from './ByAccountList';
import { HoldingSheet } from './HoldingSheet';
import { LargestChangesList } from './LargestChangesList';
import { PortfolioSummary } from './PortfolioSummary';

const route = getRouteApi('/_authenticated/investments/');

/** What the user's investments are worth and made of, and how they have done. */
export const Investments: React.FC = () => {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const accounts = React.useMemo(() => search.account ?? [], [search.account]);

  return (
    <Page
      title="Investments"
      description="What you own across your investment accounts."
      requiresConnections={{
        title: 'No investment accounts yet',
        description:
          'Connect a brokerage, TFSA, RRSP or other investment account and Opulus shows what you hold and what it is worth.',
      }}
      actions={
        <AccountFilter
          selected={accounts}
          onChange={(selected) =>
            void navigate({
              search: { account: selected.length > 0 ? selected : undefined },
              replace: true,
            })
          }
        />
      }
    >
      <InvestmentsContent
        accounts={accounts}
        holding={search.holding}
        onHoldingChange={(holding) =>
          void navigate({
            search: (previous) => ({ ...previous, holding }),
            replace: true,
          })
        }
      />
    </Page>
  );
};

// Its own component so that its queries wait until the page knows something is
// connected.
const InvestmentsContent: React.FC<{
  accounts: string[];
  holding: string | undefined;
  onHoldingChange: (holding: string | undefined) => void;
}> = ({ accounts, holding, onHoldingChange }) => {
  const holdings = useHoldings({ accountIds: accounts });

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
  // Connected, but with no investment account at all (a filter that matches
  // nothing is not that): say so, and where cash lives.
  if (holdings.data.accounts.length === 0 && accounts.length === 0) {
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
      <PortfolioSummary
        data={holdings.data}
        isRefreshing={holdings.isPlaceholderData}
      />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ByAccountList
          data={holdings.data}
          isRefreshing={holdings.isPlaceholderData}
        />
        <LargestChangesList
          data={holdings.data}
          isRefreshing={holdings.isPlaceholderData}
          onOpenHolding={onHoldingChange}
        />
      </div>
      <HoldingSheet
        data={holdings.data}
        holdingId={holding}
        onClose={() => onHoldingChange(undefined)}
      />
    </>
  );
};
