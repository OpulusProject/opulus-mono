import type { ItemPublicDTO } from '@opulus/core';
import React from 'react';

import { Spinner } from '@/components/ui';
import type { UpdateMode } from '@/hooks/linkTokens/useLinkToken';

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
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  // No linked institutions: render no rows. The empty list is the empty state.
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <ul className="divide-y rounded-md border">
      {items.map((item) => (
        <li key={item.id}>
          <ItemRow item={item} onUpdate={onUpdate} />
        </li>
      ))}
    </ul>
  );
};
