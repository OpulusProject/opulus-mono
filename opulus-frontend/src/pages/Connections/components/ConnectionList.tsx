import type { ItemDTO } from '@opulus/core/dto';
import { Landmark } from 'lucide-react';
import React from 'react';

import { List, ListEmpty } from '@/common/List';
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
}) => (
  <List isLoading={isLoading} aria-label="Connections">
    {!items || items.length === 0 ? (
      <ListEmpty
        icon={Landmark}
        title="No connections yet"
        description="Use Add connection to link a bank or credit card."
      />
    ) : (
      items.map((item) => (
        <ConnectionRow key={item.id} item={item} onUpdate={onUpdate} />
      ))
    )}
  </List>
);
