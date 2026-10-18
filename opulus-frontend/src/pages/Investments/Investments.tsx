import { getRouteApi } from '@tanstack/react-router';
import * as React from 'react';

import { List, ListError } from '@/common/List';
import { useActivitySummary } from '@/hooks/investments/useActivitySummary';
import { useHoldings } from '@/hooks/investments/useHoldings';
import { formatDay } from '@/utils/day';

import { AccountsAndGains } from './AccountsAndGains';
import { HoldingSheet } from './HoldingSheet';
import { HoldingsList } from './HoldingsList';
import { InvestmentsFrame } from './InvestmentsFrame';
import { InvestmentStats } from './InvestmentStats';
import { PortfolioSummary } from './PortfolioSummary';
import type { OverviewSearch } from './searchSchema';

const route = getRouteApi('/_authenticated/investments/');

/** What the user owns across their investment accounts, and how it has done. */
export const Investments: React.FC = () => {
  const search = route.useSearch();
  const navigate = route.useNavigate();

  const update = (changes: Partial<OverviewSearch>) =>
    void navigate({
      search: (previous) =>
        Object.fromEntries(
          Object.entries({ ...previous, ...changes }).filter(
            ([, value]) => value !== undefined
          )
        ),
      replace: true,
    });

  return (
    <InvestmentsFrame
      description="What you own across your investment accounts."
      active="overview"
      account={search.account}
      onAccountChange={(account) =>
        update({ account, holding: undefined, type: undefined })
      }
    >
      <OverviewContent search={search} update={update} />
    </InvestmentsFrame>
  );
};

// Its own component so that its queries wait until the page knows something is
// connected.
const OverviewContent: React.FC<{
  search: OverviewSearch;
  update: (changes: Partial<OverviewSearch>) => void;
}> = ({ search, update }) => {
  const holdings = useHoldings({
    accountId: search.account,
    accountSubtype: search.type,
    sort: search.layout === 'accounts' ? 'account' : undefined,
  });
  const activity = useActivitySummary(search.account);
  // The types to pick from are those of all the accounts, not just those in view.
  const subtypes = useHoldings().data?.accounts.flatMap((account) =>
    account.subtype ? [account.subtype] : []
  );

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
  const data = holdings.data;

  return (
    <>
      <PortfolioSummary data={data} />
      {activity.data && (
        <InvestmentStats activity={activity.data} holdings={data} />
      )}
      <AccountsAndGains
        data={data}
        onOpenHolding={(holding) => update({ holding })}
      />
      <HoldingsList
        data={data}
        subtypes={[...new Set(subtypes)]}
        layout={search.layout}
        type={search.type}
        onLayoutChange={(layout) => update({ layout })}
        onTypeChange={(type) => update({ type })}
        onOpenHolding={(holding) => update({ holding })}
      />
      <p className="text-muted-foreground text-xs leading-5">
        Prices are as your institutions last reported them (usually the previous
        close), not live quotes, and values are in{' '}
        {data.baseCurrency === 'CAD' ? 'Canadian dollars' : data.baseCurrency}.
        Gains use the cost basis your institution reports; where it sends none,
        that holding is left out of the gain.
        {latestPriceDay(data.holdings) &&
          ` The latest price is from ${latestPriceDay(data.holdings)}.`}
      </p>
      <HoldingSheet
        data={data}
        holdingId={search.holding}
        onClose={() => update({ holding: undefined })}
      />
    </>
  );
};

/** The most recent price date among the holdings, as "Oct 15", if any has one. */
function latestPriceDay(
  holdings: { priceAsOf: string | null }[]
): string | undefined {
  const dates = holdings.flatMap((h) => (h.priceAsOf ? [h.priceAsOf] : []));
  if (dates.length === 0) return undefined;
  return formatDay(dates.sort().at(-1)!, { month: 'short', day: 'numeric' });
}
