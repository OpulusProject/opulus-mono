import { Plus } from 'lucide-react';
import React from 'react';

import { Avatar, AvatarFallback, Card } from '@/components/ui';

interface AddAccountCardProps {
  onAddAccount: () => void;
}

export const AddAccountCard: React.FC<AddAccountCardProps> = ({
  onAddAccount,
}) => {
  return (
    <Card
      className="flex cursor-pointer flex-row items-center gap-4 p-4 transition-opacity hover:opacity-80"
      onClick={onAddAccount}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAddAccount();
        }
      }}
    >
      <Avatar className="size-10 shrink-0 border-2 border-dashed">
        <AvatarFallback>
          <Plus className="size-5" />
        </AvatarFallback>
      </Avatar>
      <div className="text-sm font-medium">Add account</div>
    </Card>
  );
};
