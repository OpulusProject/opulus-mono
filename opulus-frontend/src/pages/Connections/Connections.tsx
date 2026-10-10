import { Plus } from 'lucide-react';
import { useState } from 'react';

import { LaunchLink } from '@/common/LaunchLink';
import { PageHeader } from '@/common/PageHeader';
import { Button } from '@/components/ui';
import { useItems } from '@/hooks/items/useItems';
import type { UpdateMode } from '@/hooks/linkTokens/useLinkToken';

import { ConnectionList } from './components';

interface UpdateTarget {
  itemId: string;
  mode: UpdateMode;
}

export const Connections: React.FC = () => {
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<UpdateTarget | undefined>();
  const { data: itemsData, isLoading } = useItems();

  const items = itemsData?.items;

  const openLink = (target?: UpdateTarget) => {
    setUpdateTarget(target);
    setIsLinkOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <PageHeader
          title="Your connections"
          description="Connect the banks and cards Opulus tracks. Your accounts and transactions stay in sync automatically."
          actions={
            <Button type="button" onClick={() => openLink()}>
              <Plus className="size-4" />
              Add connection
            </Button>
          }
        />

        <ConnectionList
          items={items}
          isLoading={isLoading}
          onUpdate={(itemId, mode) => openLink({ itemId, mode })}
        />
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
    </>
  );
};
