import { Landmark } from 'lucide-react';
import * as React from 'react';

import { type SummaryStat, SummaryStats } from '@/common/AccountsOverview';
import { List, ListError } from '@/common/List';
import { Skeleton } from '@/components/ui';
import { useAccounts } from '@/hooks/accounts/useAccounts';
import { formatMoney } from '@/utils/accountDisplay';
import { type NetWorth as NetWorthTotals, getNetWorth } from '@/utils/netWorth';

import { DashboardEmpty } from './DashboardEmpty';

/** "$1,000.00", or "$1,000.00 + US$50.00" when the accounts span currencies. */
const format = (
  totals: NetWorthTotals[],
  pick: (total: NetWorthTotals) => number
) => totals.map((t) => formatMoney(pick(t), t.currency)).join(' + ');

/** Net worth and what it is made of: cash, investments and what is owed. */
export const NetWorth: React.FC = () => {
  const accounts = useAccounts();

  const totals = React.useMemo(
    () => getNetWorth(accounts.data?.accounts ?? []),
    [accounts.data]
  );

  if (accounts.isLoading) return <NetWorthSkeleton />;

  if (accounts.isError) {
    return (
      <List>
        <ListError
          subject="your balances"
          onRetry={() => void accounts.refetch()}
        />
      </List>
    );
  }

  if (totals.length === 0) {
    return (
      <List>
        <DashboardEmpty
          icon={Landmark}
          noConnections
          title="No accounts yet"
          description="Connect an account to see your net worth."
        />
      </List>
    );
  }

  const stats: SummaryStat[] = [
    { label: 'Cash', value: format(totals, (t) => t.cash) },
    { label: 'Investments', value: format(totals, (t) => t.investments) },
    { label: 'Owed', value: format(totals, (t) => t.owed) },
  ];
  // Only shown when there is something, so the figures still add up to the total.
  if (totals.some((t) => t.other !== 0)) {
    stats.push({ label: 'Other', value: format(totals, (t) => t.other) });
  }

  return (
    <section aria-label="Net worth" className="flex flex-col gap-4">
      <div className="rounded-md border p-4">
        <div className="text-muted-foreground text-xs">Net worth</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums break-words sm:text-3xl">
          {format(totals, (t) => t.netWorth)}
        </div>
        <div className="text-muted-foreground mt-0.5 text-xs">
          What you own minus what you owe
        </div>
      </div>
      <SummaryStats stats={stats} />
    </section>
  );
};

const NetWorthSkeleton: React.FC = () => (
  <div aria-busy aria-label="Loading net worth" className="flex flex-col gap-4">
    <div className="space-y-2 rounded-md border p-4">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-3 w-48" />
    </div>
    <div className="grid gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="space-y-2 rounded-md border p-4">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </div>
  </div>
);
