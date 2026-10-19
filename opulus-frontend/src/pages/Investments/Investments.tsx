import { getRouteApi } from '@tanstack/react-router';
import * as React from 'react';

import { List, ListError } from '@/common/List';
import { useActivitySummary } from '@/hooks/investments/useActivitySummary';
import { useHoldings } from '@/hooks/investments/useHoldings';

import { AccountsAndGains } from './AccountsAndGains';
import { HoldingSheet } from './HoldingSheet';
import { HoldingsList } from './HoldingsList';
import { InvestmentActivity } from './InvestmentActivity';
import { InvestmentsFrame } from './InvestmentsFrame';
import { InvestmentStats } from './InvestmentStats';
import { PortfolioSummary } from './PortfolioSummary';
import type { InvestmentsSearch } from './searchSchema';

const route = getRouteApi('/_authenticated/investments');

/**
 * What the user's investments are worth and made of, what they hold, and what
 * went in, came out and was earned: one page, top to bottom.
 */
export const Investments: React.FC = () => {
  const search = route.useSearch();
  const navigate = route.useNavigate();

  const update = (changes: Partial<InvestmentsSearch>) =>
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
      title="Investments"
      description="What you own across your investment accounts."
      account={search.account}
      onAccountChange={(account) =>
        update({ account, holding: undefined, type: undefined })
      }
    >
      <InvestmentsContent search={search} update={update} />
    </InvestmentsFrame>
  );
};

// Its own component so that its queries wait until the page knows something is
// connected.
const InvestmentsContent: React.FC<{
  search: InvestmentsSearch;
  update: (changes: Partial<InvestmentsSearch>) => void;
}> = ({ search, update }) => {
  // What the page is about: the account in view. The holdings list below may
  // narrow it further (an account type, or account by account).
  const holdings = useHoldings({ accountId: search.account });
  const listed = useHoldings({
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
      {activity.data && <InvestmentStats activity={activity.data} />}
      <PortfolioSummary data={data} isRefreshing={holdings.isPlaceholderData} />
      <AccountsAndGains
        data={data}
        isRefreshing={holdings.isPlaceholderData}
        onOpenAccount={(account) =>
          update({ account, holding: undefined, type: undefined })
        }
        onOpenHolding={(holding) => update({ holding })}
      />
      {listed.data && (
        <HoldingsList
          data={listed.data}
          isRefreshing={listed.isPlaceholderData}
          subtypes={[...new Set(subtypes)]}
          layout={search.layout}
          type={search.type}
          onLayoutChange={(layout) => update({ layout })}
          onTypeChange={(type) => update({ type })}
          onOpenHolding={(holding) => update({ holding })}
        />
      )}
      <InvestmentActivity search={search} update={update} />
      <HoldingSheet
        data={data}
        holdingId={search.holding}
        onClose={() => update({ holding: undefined })}
      />
    </>
  );
};
