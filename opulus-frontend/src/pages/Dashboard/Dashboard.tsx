import { AppLayout } from '@/common/AppLayout';

import { DataTable, SectionCards, SpendingChart } from './components';

export default function Dashboard() {
  return (
    <AppLayout title="Dashboard">
      <SectionCards />
      <div className="px-4 lg:px-6">
        <SpendingChart />
      </div>
      <DataTable />
    </AppLayout>
  );
}
