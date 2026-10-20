import { Link } from '@tanstack/react-router';
import * as React from 'react';

import { cn } from '@/lib/utils';

const TABS = [
  { key: 'overview', label: 'Overview', to: '/investments' },
  { key: 'holdings', label: 'Holdings', to: '/investments/holdings' },
] as const;

export type InvestmentsTab = (typeof TABS)[number]['key'];

interface InvestmentsTabsProps {
  active: InvestmentsTab;
  /** The accounts the page is limited to; they carry over to the other page. */
  accounts: string[];
}

/** The pages of Investments, as a toggle in the page header. */
export const InvestmentsTabs: React.FC<InvestmentsTabsProps> = ({
  active,
  accounts,
}) => (
  <nav aria-label="Investments" className="bg-muted flex rounded-lg p-0.5">
    {TABS.map((tab) => (
      <Link
        key={tab.key}
        to={tab.to}
        search={{ account: accounts.length > 0 ? accounts : undefined }}
        aria-current={active === tab.key ? 'page' : undefined}
        className={cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          active === tab.key
            ? 'bg-background shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {tab.label}
      </Link>
    ))}
  </nav>
);
