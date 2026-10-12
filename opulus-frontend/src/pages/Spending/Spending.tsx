import { PiggyBank } from 'lucide-react';

import { List, ListEmpty } from '@/common/List';
import { Page } from '@/common/Page';

/** Placeholder until the page is built: spending by month, category and merchant. */
export const Spending: React.FC = () => (
  <Page
    title="Spending"
    description="Where your money went, by month and category."
    requiresConnections={{
      title: 'No spending yet',
      description: 'Connect an account to see where your money goes.',
    }}
  >
    <List aria-label="Spending">
      <ListEmpty
        icon={PiggyBank}
        title="Coming soon"
        description="A breakdown of your spending will appear here."
      />
    </List>
  </Page>
);
