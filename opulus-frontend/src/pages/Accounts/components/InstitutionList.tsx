import { Plus } from 'lucide-react';
import React, { useState } from 'react';

import { LaunchLink } from '@/common/LaunchLink';
import { Button, Spinner } from '@/components/ui';
import { useItems } from '@/hooks/items/useItems';
import type { UpdateMode } from '@/hooks/plaid/useLinkToken';

import { EmptyAccountsView } from './EmptyAccountsView';
import { ItemRow } from './ItemRow';

interface UpdateTarget {
  itemId: string;
  mode: UpdateMode;
}

export const InstitutionList: React.FC = () => {
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<UpdateTarget | undefined>();
  const { data: itemsData, isLoading } = useItems();

  const handleLinkSuccess = (publicToken: string, metadata: unknown) => {
    console.log('Plaid Link Success:', { publicToken, metadata });
  };

  const handleLinkExit = (error: unknown, metadata: unknown) => {
    if (error) {
      console.error('Plaid Link Error:', error);
    }
    console.log('Plaid Link Exit:', metadata);
  };

  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <Spinner className="size-6" />
        </div>
      ) : itemsData && itemsData.items.length > 0 ? (
        <div className="rounded-md border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-medium">Linked institutions</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setUpdateTarget(undefined);
                setIsLinkOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add institution
            </Button>
          </div>
          <ul className="divide-y">
            {itemsData.items.map((item) => (
              <li key={item.id}>
                <ItemRow
                  item={item}
                  onUpdate={(itemId, mode) => {
                    setUpdateTarget({ itemId, mode });
                    setIsLinkOpen(true);
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div
          className={`transition-opacity duration-300 ${
            isLinkOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <EmptyAccountsView onAddAccount={() => setIsLinkOpen(true)} />
        </div>
      )}
      {isLinkOpen && (
        <LaunchLink
          itemId={updateTarget?.itemId}
          updateMode={updateTarget?.mode}
          onClose={() => {
            setIsLinkOpen(false);
            setUpdateTarget(undefined);
          }}
          onSuccess={handleLinkSuccess}
          onExit={handleLinkExit}
        />
      )}
    </>
  );
};
