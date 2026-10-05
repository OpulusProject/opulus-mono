import type { ItemPublicDTO } from '@opulus/core';
import React from 'react';

import { Spinner } from '@/components/ui';
import type { UpdateMode } from '@/hooks/linkTokens/useLinkToken';

import { EmptyInstitutionsView } from './EmptyInstitutionsView';
import { ItemRow } from './ItemRow';

interface InstitutionListProps {
  items: ItemPublicDTO[] | undefined;
  isLoading: boolean;
  onUpdate: (itemId: string, mode: UpdateMode) => void;
}

export const InstitutionList: React.FC<InstitutionListProps> = ({
  items,
  isLoading,
  onUpdate,
}) => {
  return (
    <div className="rounded-md border">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="size-6" />
        </div>
      ) : !items || items.length === 0 ? (
        <EmptyInstitutionsView />
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id}>
              <ItemRow item={item} onUpdate={onUpdate} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
