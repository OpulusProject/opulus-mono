import { PiggyBank } from 'lucide-react';

import { List, ListEmpty } from '@/common/List';
import { PageHeader } from '@/common/PageHeader';

/** Placeholder until the page is built: spending by month, category and merchant. */
export const Spending: React.FC = () => (
  <div className="flex flex-col gap-6 px-4 lg:px-6">
    <PageHeader
      title="Spending"
      description="Where your money went, by month and category."
    />
    <List aria-label="Spending">
      <ListEmpty
        icon={PiggyBank}
        title="Coming soon"
        description="A breakdown of your spending will appear here."
      />
    </List>
  </div>
);
