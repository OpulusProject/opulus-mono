import { Plus } from 'lucide-react';
import { useState } from 'react';

import { AppLayout } from '@/common/AppLayout';
import { LaunchLink } from '@/common/LaunchLink';
import { PageHeader } from '@/common/PageHeader';
import { Button } from '@/components/ui';
import { useItems } from '@/hooks/items/useItems';
import type { UpdateMode } from '@/hooks/linkTokens/useLinkToken';

import { InstitutionList } from './components';

interface UpdateTarget {
  itemId: string;
  mode: UpdateMode;
}

export const Institutions: React.FC = () => {
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<UpdateTarget | undefined>();
  const { data: itemsData, isLoading } = useItems();

  const items = itemsData?.items;

  const openLink = (target?: UpdateTarget) => {
    setUpdateTarget(target);
    setIsLinkOpen(true);
  };

  return (
    <AppLayout title="Institutions" section="Settings">
      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <PageHeader
          title="Linked institutions"
          description="Connect the banks and cards Opulus tracks. You only need to do this once: after linking, your accounts and transactions stay in sync automatically."
          actions={
            <Button type="button" onClick={() => openLink()}>
              <Plus className="size-4" />
              Add institution
            </Button>
          }
        />

        <InstitutionList
          items={items}
          isLoading={isLoading}
          onUpdate={(itemId, mode) => openLink({ itemId, mode })}
        />

        <p className="text-muted-foreground max-w-prose text-xs">
          Connections are made securely through Plaid. Opulus gets read-only
          access and never sees your bank login. Disconnecting an institution
          permanently deletes its accounts and transactions from Opulus.
        </p>
      </div>

      {isLinkOpen && (
        <LaunchLink
          itemId={updateTarget?.itemId}
          updateMode={updateTarget?.mode}
          onClose={() => {
            setIsLinkOpen(false);
            setUpdateTarget(undefined);
          }}
        />
      )}
    </AppLayout>
  );
};
