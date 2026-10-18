import { getRouteApi } from '@tanstack/react-router';
import * as React from 'react';

import { List, ListError } from '@/common/List';
import { useHoldings } from '@/hooks/investments/useHoldings';

import { AccountsAndGains } from './AccountsAndGains';
import { InvestmentsFrame } from './InvestmentsFrame';
import { PortfolioSummary } from './PortfolioSummary';
import type { OverviewSearch } from './searchSchema';

const route = getRouteApi('/_authenticated/investments/');

/** What the user's investments are worth and made of, and how they have done. */
export const Investments: React.FC = () => {
  const search = route.useSearch();
  const navigate = route.useNavigate();

  return (
    <InvestmentsFrame
      description="What you own across your investment accounts."
      active="overview"
      account={search.account}
      onAccountChange={(account) =>
        void navigate({
          search: (previous: OverviewSearch) => ({ ...previous, account }),
          replace: true,
        })
      }
    >
      <OverviewContent account={search.account} />
    </InvestmentsFrame>
  );
};

// Its own component so that its queries wait until the page knows something is
// connected.
const OverviewContent: React.FC<{ account: string | undefined }> = ({
  account,
}) => {
  const holdings = useHoldings({ accountId: account });

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
      <PortfolioSummary data={holdings.data} />
      <AccountsAndGains data={holdings.data} account={account} />
    </>
  );
};
