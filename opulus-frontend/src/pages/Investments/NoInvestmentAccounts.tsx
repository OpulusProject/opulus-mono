import { Link } from '@tanstack/react-router';
import { Landmark } from 'lucide-react';
import * as React from 'react';

import { List, ListEmpty } from '@/common/List';
import { Button } from '@/components/ui';

/** Connected, but with no investment account at all: say so, and where cash lives. */
export const NoInvestmentAccounts: React.FC = () => (
  <List>
    <ListEmpty
      icon={Landmark}
      title="No investment accounts yet"
      description="Connect a brokerage, TFSA, RRSP or other investment account and Opulus shows what you hold and what it is worth. Your cash accounts are on the Accounts page."
      action={
        <Button asChild>
          <Link to="/settings/connections">Go to connections</Link>
        </Button>
      }
    />
  </List>
);
