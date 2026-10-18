import { getRouteApi } from '@tanstack/react-router';
import * as React from 'react';

import { List, ListError } from '@/common/List';
import { useHoldings } from '@/hooks/investments/useHoldings';
import { formatDay } from '@/utils/day';

import { HoldingSheet } from './HoldingSheet';
import { HoldingsList } from './HoldingsList';
import { InvestmentsFrame } from './InvestmentsFrame';
import type { HoldingsSearch } from './searchSchema';

const route = getRouteApi('/_authenticated/investments/holdings');

/** Everything the user holds, as a list or account by account, each with its sheet. */
export const InvestmentHoldings: React.FC = () => {
  const search = route.useSearch();
  const navigate = route.useNavigate();

  const update = (changes: Partial<HoldingsSearch>) =>
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
      description="Everything you hold, account by account."
      active="holdings"
      account={search.account}
      onAccountChange={(account) =>
        update({ account, holding: undefined, type: undefined })
      }
    >
      <HoldingsContent search={search} update={update} />
    </InvestmentsFrame>
  );
};

// Its own component so that its queries wait until the page knows something is
// connected.
const HoldingsContent: React.FC<{
  search: HoldingsSearch;
  update: (changes: Partial<HoldingsSearch>) => void;
}> = ({ search, update }) => {
  const holdings = useHoldings({
    accountId: search.account,
    accountSubtype: search.type,
    sort: search.layout === 'accounts' ? 'account' : undefined,
  });
  // The types to pick from are those of all the accounts, not just those in view.
  const subtypes = useHoldings().data?.accounts.flatMap((account) =>
    account.subtype ? [account.subtype] : []
  );

  if (holdings.isLoading) return <List isLoading aria-label="Loading" />;
  if (holdings.isError || !holdings.data) {
    return (
      <List>
        <ListError
          subject="your holdings"
          onRetry={() => void holdings.refetch()}
        />
      </List>
    );
  }
  const data = holdings.data;

  return (
    <>
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
