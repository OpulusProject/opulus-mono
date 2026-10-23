import { getRouteApi } from '@tanstack/react-router';
import * as React from 'react';

import { List, ListError } from '@/common/List';
import { Page } from '@/common/Page';
import { useHoldings } from '@/hooks/investments/useHoldings';

import { AccountFilter } from './AccountFilter';
import { DateRangeFilter } from './DateRangeFilter';
import { HoldingSheet } from './HoldingSheet';
import { HoldingsList } from './HoldingsList';
import { NoInvestmentAccounts } from './NoInvestmentAccounts';
import { type OverviewSearch, holdingsPeriod } from './searchSchema';

const route = getRouteApi('/_authenticated/investments/holdings');

/** Everything the user holds, as a list or account by account, each with its sheet. */
export const InvestmentHoldings: React.FC = () => {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const accounts = React.useMemo(() => search.account ?? [], [search.account]);

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
    <Page
      title="Investments"
      description="Everything you hold, by kind of investment."
      requiresConnections={{
        title: 'No investment accounts yet',
        description:
          'Connect a brokerage, TFSA, RRSP or other investment account and Opulus shows what you hold and what it is worth.',
      }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter search={search} onChange={update} />
          <AccountFilter
            selected={accounts}
            onChange={(selected) =>
              update({
                account: selected.length > 0 ? selected : undefined,
                holding: undefined,
              })
            }
          />
        </div>
      }
    >
      <HoldingsContent search={search} update={update} />
    </Page>
  );
};

// Its own component so that its queries wait until the page knows something is
// connected.
const HoldingsContent: React.FC<{
  search: OverviewSearch;
  update: (changes: Partial<OverviewSearch>) => void;
}> = ({ search, update }) => {
  const holdings = useHoldings({
    accountIds: search.account,
    ...holdingsPeriod(search),
  });
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
  if (holdings.data.accounts.length === 0 && !search.account) {
    return <NoInvestmentAccounts />;
  }
  const data = holdings.data;

  return (
    <>
      <HoldingsList
        data={data}
        isRefreshing={holdings.isPlaceholderData}
        onOpenHolding={(holding) => update({ holding })}
      />
      <HoldingSheet
        data={data}
        holdingId={search.holding}
        onClose={() => update({ holding: undefined })}
      />
    </>
  );
};
