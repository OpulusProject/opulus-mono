import {
  type AccountEntry,
  type AccountGroupConfig,
  AccountsOverview,
  type SummaryStat,
} from '@/common/AccountsOverview';
import {
  formatMoney,
  formatTotals,
  getOverallUtilization,
} from '@/utils/accountDisplay';
import { getAccountKind } from '@/utils/accountKind';

const GROUPS: AccountGroupConfig[] = [
  { kind: 'credit', title: 'Credit cards' },
  { kind: 'loan', title: 'Loans and lines of credit' },
];

function getSummary(entries: AccountEntry[]): SummaryStat[] {
  const accounts = entries.map((entry) => entry.account);
  const cards = accounts.filter((a) => getAccountKind(a) === 'credit');
  const loans = accounts.filter((a) => getAccountKind(a) === 'loan');
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
