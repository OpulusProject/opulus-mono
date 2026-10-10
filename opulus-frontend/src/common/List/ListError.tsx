import { CircleAlert } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui';

import { ListEmpty } from './ListEmpty';

interface ListErrorProps {
  /** What failed to load, e.g. "transactions". */
  subject: string;
  onRetry: () => void;
}

/** What a list shows when its data failed to load. */
export const ListError: React.FC<ListErrorProps> = ({ subject, onRetry }) => (
  <ListEmpty
    icon={CircleAlert}
    title={`Couldn't load ${subject}`}
    description="Something went wrong. Try again."
    action={
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    }
  />
);
