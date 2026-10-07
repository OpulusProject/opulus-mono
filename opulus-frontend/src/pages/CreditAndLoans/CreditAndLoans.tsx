import type { AccountWithConnection } from '@opulus/core';

import {
  type AccountGroupConfig,
  AccountsOverview,
  type SummaryStat,
} from '@/common/AccountsOverview';
import {
  formatMoney,
  formatTotals,
  getOverallUtilization,
} from '@/utils/accountDisplay';
import { getAccountType } from '@/utils/accountType';

const GROUPS: AccountGroupConfig[] = [
  { type: 'credit', title: 'Credit cards' },
  { type: 'loan', title: 'Loans and lines of credit' },
];

function getSummary(accounts: AccountWithConnection[]): SummaryStat[] {
  const cards = accounts.filter((a) => getAccountType(a) === 'credit');
  const loans = accounts.filter((a) => getAccountType(a) === 'loan');
  const utilization = getOverallUtilization(cards);

  return [
    {
      label: 'Total owed',
      value: formatTotals(accounts),
      detail: `${accounts.length} account${accounts.length === 1 ? '' : 's'}`,
    },
    {
      label: 'Credit cards',
      value: formatTotals(cards),
      detail: utilization
        ? `${Math.round(utilization.utilization * 100)}% of ${formatMoney(utilization.limit, utilization.currency)} limit used`
        : `${cards.length} card${cards.length === 1 ? '' : 's'}`,
    },
    {
      label: 'Loans',
      value: formatTotals(loans),
      detail: `${loans.length} loan${loans.length === 1 ? '' : 's'}`,
    },
  ];
}

export const CreditAndLoans: React.FC = () => {
  return (
    <AccountsOverview
      title="Credit & loans"
      heading="Credit and loans"
      description="What you owe across credit cards, lines of credit, and loans."
      groups={GROUPS}
      getSummary={getSummary}
      emptyTitle="No credit or loans yet"
      emptyDescription="Credit cards, lines of credit, and loans from your connections will show up here."
    />
  );
};
