import { Landmark } from 'lucide-react';
import * as React from 'react';

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

/** Net worth: everything owned minus everything owed. */
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

  return (
    <section aria-label="Net worth" className="rounded-md border p-4">
      <div className="text-muted-foreground text-xs">Net worth</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums break-words sm:text-3xl">
        {format(totals, (t) => t.netWorth)}
      </div>
    </section>
  );
};

const NetWorthSkeleton: React.FC = () => (
  <div
    aria-busy
    aria-label="Loading net worth"
    className="space-y-2 rounded-md border p-4"
  >
    <Skeleton className="h-3 w-16" />
    <Skeleton className="h-8 w-40" />
  </div>
);
