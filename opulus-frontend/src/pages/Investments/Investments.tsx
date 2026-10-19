import * as React from 'react';

import { List, ListError } from '@/common/List';
import { useHoldings } from '@/hooks/investments/useHoldings';

import { InvestmentsFrame } from './InvestmentsFrame';
import { PortfolioSummary } from './PortfolioSummary';

/** What the user's investments are worth and made of, and how they have done. */
export const Investments: React.FC = () => (
  <InvestmentsFrame
    title="Investments"
    description="What you own across your investment accounts."
  >
    <InvestmentsContent />
  </InvestmentsFrame>
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

  return <PortfolioSummary data={holdings.data} />;
};
