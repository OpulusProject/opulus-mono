import { getRouteApi } from '@tanstack/react-router';
import * as React from 'react';

import { List, ListError } from '@/common/List';
import { useActivitySummary } from '@/hooks/investments/useActivitySummary';
import { useHoldings } from '@/hooks/investments/useHoldings';

import { AccountsAndGains } from './AccountsAndGains';
import { HoldingSheet } from './HoldingSheet';
import { InvestmentsFrame } from './InvestmentsFrame';
import { InvestmentStats } from './InvestmentStats';
import { PortfolioSummary } from './PortfolioSummary';
import type { OverviewSearch } from './searchSchema';

const route = getRouteApi('/_authenticated/investments/');

/** What the user's investments are worth and made of, and how they have done. */
export const Investments: React.FC = () => {
  const search = route.useSearch();
  const navigate = route.useNavigate();

  return (
    <InvestmentsFrame
      title="Investments"
      active="overview"
      description="What you own across your investment accounts."
      account={search.account}
      onAccountChange={(account) =>
        void navigate({
          search: (previous: OverviewSearch) => ({ ...previous, account }),
          replace: true,
        })
      }
    >
      <OverviewContent
        account={search.account}
        holding={search.holding}
        onHoldingChange={(holding) =>
          void navigate({
            search: (previous: OverviewSearch) => ({ ...previous, holding }),
            replace: true,
          })
        }
      />
    </InvestmentsFrame>
  );
};

// Its own component so that its queries wait until the page knows something is
// connected.
const OverviewContent: React.FC<{
  account: string | undefined;
  holding: string | undefined;
  onHoldingChange: (holding: string | undefined) => void;
}> = ({ account, holding, onHoldingChange }) => {
  const holdings = useHoldings({ accountId: account });
  const activity = useActivitySummary(account);

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

  return (
    <>
      {activity.data && <InvestmentStats activity={activity.data} />}
      <PortfolioSummary
        data={holdings.data}
        isRefreshing={holdings.isPlaceholderData}
      />
      <AccountsAndGains
        data={holdings.data}
        isRefreshing={holdings.isPlaceholderData}
        onOpenHolding={onHoldingChange}
      />
      <HoldingSheet
        data={holdings.data}
        holdingId={holding}
        onClose={() => onHoldingChange(undefined)}
      />
    </>
  );
};
