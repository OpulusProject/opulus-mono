import { PageHeader } from '@/common/PageHeader';

import { NetWorth } from './NetWorth';
import { RecentTransactions } from './RecentTransactions';
import { SpendingByCategory } from './SpendingByCategory';

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Overview"
        description="Where your money stands and where it went this month."
      />
      <NetWorth />
      {/* Side by side on wide screens, stacked below that. */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <SpendingByCategory />
        <RecentTransactions />
      </div>
    </div>
  );
}
