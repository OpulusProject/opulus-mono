import { AppLayout } from '@/common/AppLayout';
import { PageHeader } from '@/common/PageHeader';
import { Spinner } from '@/components/ui';
import { useItems } from '@/hooks/items/useItems';

import { AccountsByInstitution, EmptyAccountsView } from './components';

export const Accounts: React.FC = () => {
  const { data: itemsData, isLoading } = useItems();
  const items = itemsData?.items ?? [];

  return (
    <AppLayout title="Accounts">
      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <PageHeader
          title="Accounts"
          description="Your accounts, grouped by institution. Manage your connections in Settings."
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="size-6" />
          </div>
        ) : items.length === 0 ? (
          <EmptyAccountsView />
        ) : (
          <AccountsByInstitution items={items} />
        )}
      </div>
    </AppLayout>
  );
};
