import { Link } from '@tanstack/react-router';
import { Landmark } from 'lucide-react';
import React from 'react';

import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui';

export const EmptyAccountsView: React.FC = () => {
  return (
    <Empty className="rounded-md border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Landmark />
        </EmptyMedia>
        <EmptyTitle>No accounts yet</EmptyTitle>
        <EmptyDescription>
          Add a connection in Settings and its accounts will appear here.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link to="/settings/connections">Add a connection</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
};
