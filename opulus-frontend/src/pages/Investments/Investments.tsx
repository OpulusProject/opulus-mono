import { getRouteApi } from '@tanstack/react-router';
import * as React from 'react';

import { List, ListError } from '@/common/List';
import { Page } from '@/common/Page';
import { useHoldings } from '@/hooks/investments/useHoldings';

import { AccountFilter } from './AccountFilter';
import { ByAccountList } from './ByAccountList';
import { HoldingSheet } from './HoldingSheet';
import { LargestChangesList } from './LargestChangesList';
import { NoInvestmentAccounts } from './NoInvestmentAccounts';
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
        <div className="flex flex-wrap items-center gap-2">
          <AccountFilter
            selected={accounts}
            onChange={(selected) =>
              void navigate({
                search: { account: selected.length > 0 ? selected : undefined },
                replace: true,
              })
            }
          />
        </div>
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
    return <NoInvestmentAccounts />;
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
