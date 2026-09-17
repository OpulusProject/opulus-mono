import { Plus } from 'lucide-react';
import React from 'react';

import {
  Avatar,
  AvatarFallback,
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui';

interface AddAccountCardProps {
  onAddAccount: () => void;
}

export const AddAccountCard: React.FC<AddAccountCardProps> = ({
  onAddAccount,
}) => {
  return (
    <Card
      className="w-[310px] p-8 cursor-pointer hover:opacity-80 transition-opacity flex flex-col items-center justify-center"
      onClick={onAddAccount}
    >
      <CardHeader className="flex items-center justify-center">
        <Avatar className="size-14 border-2 border-dashed">
          <AvatarFallback>
            <Plus className="size-8" />
          </AvatarFallback>
        </Avatar>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="text-sm">Add Account</div>
      </CardContent>
    </Card>
  );
};
