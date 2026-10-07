import type { ItemDTO } from '@opulus/core/dto';
import { Landmark } from 'lucide-react';
import React from 'react';

import { Spinner } from '@/components/ui';
import type { UpdateMode } from '@/hooks/linkTokens/useLinkToken';

import { ConnectionRow } from './ConnectionRow';

interface ConnectionListProps {
  items: ItemDTO[] | undefined;
  isLoading: boolean;
  onUpdate: (itemId: string, mode: UpdateMode) => void;
}

export const ConnectionList: React.FC<ConnectionListProps> = ({
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

  return (
    <ul className="divide-y rounded-md border">
      {!items || items.length === 0 ? (
        // Mirrors a ConnectionRow so the list is the same height when empty.
        <li className="flex items-center gap-3 px-4 py-3">
          <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-[10px]">
            <Landmark className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">No connections yet</div>
            <div className="text-muted-foreground truncate text-xs">
              Use Add connection to link a bank or credit card.
            </div>
          </div>
        </li>
      ) : (
        items.map((item) => (
          <li key={item.id}>
            <ConnectionRow item={item} onUpdate={onUpdate} />
          </li>
        ))
      )}
    </ul>
  );
};
