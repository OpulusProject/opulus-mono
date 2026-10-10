import { Page } from '@/common/Page';

import { NetWorth } from './NetWorth';
import { RecentTransactions } from './RecentTransactions';
import { SpendingByCategory } from './SpendingByCategory';

export default function Dashboard() {
  return (
    <Page
      title="Overview"
      description="Where your money stands and where it went this month."
      requiresConnections={{
        title: 'No overview yet',
        description:
          'Connect an account to see your net worth, spending and recent activity.',
      }}
    >
      <NetWorth />
      {/* Side by side on wide screens, stacked below that. */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <SpendingByCategory />
        <RecentTransactions />
      </div>
    </Page>
  );
}
