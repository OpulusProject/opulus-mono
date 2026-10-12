import { Page } from '@/common/Page';

import { RecentTransactions } from './RecentTransactions';
import { SpendingByCategory } from './SpendingByCategory';

export default function Dashboard() {
  return (
    <Page
      title="Overview"
      description="Where your money went this month, and your latest activity."
      requiresConnections={{
        title: 'No overview yet',
        description:
          'Connect an account to see your spending and recent activity.',
      }}
    >
      {/* Side by side on wide screens, stacked below that. */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <SpendingByCategory />
        <RecentTransactions />
      </div>
    </Page>
  );
}
