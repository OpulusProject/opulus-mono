import { Hourglass } from 'lucide-react';
import * as React from 'react';

import { List, ListEmpty } from '@/common/List';
import { Page } from '@/common/Page';

interface ComingSoonProps {
  title: string;
  description: string;
}

/** A Spending page that is routed and in the sidebar but not built yet. */
export const ComingSoon: React.FC<ComingSoonProps> = ({
  title,
  description,
}) => (
  <Page title={title} description={description}>
    <List aria-label={title}>
      <ListEmpty
        icon={Hourglass}
        title="Coming soon"
        description="This page is still being built."
      />
    </List>
  </Page>
);
