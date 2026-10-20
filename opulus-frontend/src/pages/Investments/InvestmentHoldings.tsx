import { getRouteApi } from '@tanstack/react-router';
import * as React from 'react';

import { List, ListError } from '@/common/List';
import { Page } from '@/common/Page';
import { useHoldings } from '@/hooks/investments/useHoldings';

import { AccountFilter } from './AccountFilter';
import { HoldingSheet } from './HoldingSheet';
import { HoldingsList } from './HoldingsList';
import { InvestmentsTabs } from './InvestmentsTabs';
import { NoInvestmentAccounts } from './NoInvestmentAccounts';
import type { HoldingsSearch } from './searchSchema';

const route = getRouteApi('/_authenticated/investments/holdings');

/** Everything the user holds, as a list or account by account, each with its sheet. */
export const InvestmentHoldings: React.FC = () => {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const accounts = React.useMemo(() => search.account ?? [], [search.account]);

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
    <Page
      title="Investments"
      description="Everything you hold, account by account."
      requiresConnections={{
        title: 'No investment accounts yet',
        description:
          'Connect a brokerage, TFSA, RRSP or other investment account and Opulus shows what you hold and what it is worth.',
      }}
      actions={
        // Wraps, so on a phone the filter goes under the toggle.
        <div className="flex flex-wrap items-center gap-2">
          <InvestmentsTabs active="holdings" accounts={accounts} />
          <AccountFilter
            selected={accounts}
            onChange={(selected) =>
              update({
                account: selected.length > 0 ? selected : undefined,
                holding: undefined,
                type: undefined,
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
  search: HoldingsSearch;
  update: (changes: Partial<HoldingsSearch>) => void;
}> = ({ search, update }) => {
  const holdings = useHoldings({
    accountIds: search.account,
    accountSubtype: search.type,
    sort: search.layout === 'accounts' ? 'account' : undefined,
  });
  // The types to pick from are those of all the accounts, not just those in view.
  const all = useHoldings().data;
  const subtypes = all?.accounts.flatMap((account) =>
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
  if (all?.accounts.length === 0) return <NoInvestmentAccounts />;
  const data = holdings.data;

  return (
    <>
      <HoldingsList
        data={data}
        isRefreshing={holdings.isPlaceholderData}
        subtypes={[...new Set(subtypes)]}
        layout={search.layout}
        type={search.type}
        onLayoutChange={(layout) => update({ layout })}
        onTypeChange={(type) => update({ type })}
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
