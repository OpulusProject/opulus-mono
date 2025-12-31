import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@gems';
import { Landmark, Plus } from 'lucide-react';
import React from 'react';

interface EmptyAccountsViewProps {
  onAddAccount: () => void;
}

export const EmptyAccountsView: React.FC<EmptyAccountsViewProps> = ({
  onAddAccount,
}) => {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Landmark />
        </EmptyMedia>
        <EmptyTitle>No Accounts Yet</EmptyTitle>
        <EmptyDescription>
          You haven&apos;t linked any accounts yet. Get started by creating your
          first account.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex gap-2">
          <Button onClick={onAddAccount}>
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
};
