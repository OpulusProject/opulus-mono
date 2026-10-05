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

interface EmptyAccountsViewProps {
  title: string;
  description: string;
}

export const EmptyAccountsView: React.FC<EmptyAccountsViewProps> = ({
  title,
  description,
}) => {
  return (
    <Empty className="rounded-md border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Landmark />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link to="/settings/connections">Go to connections</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
};
