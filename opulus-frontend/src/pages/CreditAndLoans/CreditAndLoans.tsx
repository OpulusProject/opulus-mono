import {
  type AccountGroupConfig,
  AccountsOverview,
  type SummaryStat,
} from '@/common/AccountsOverview';
import {
  type AccountsSummary,
  countLabel,
  formatBalance,
  typeSummary,
} from '@/common/AccountsOverview/summary';

const GROUPS: AccountGroupConfig[] = [
  { type: 'credit', title: 'Credit cards' },
  { type: 'loan', title: 'Loans and lines of credit' },
];

function getSummary(summary: AccountsSummary): SummaryStat[] {
  const cards = typeSummary(summary, 'credit');
  const loans = typeSummary(summary, 'loan');
  const used = cards?.credit
    ? `${Math.round(cards.credit.utilization * 100)}% of ${formatBalance(summary, cards.credit.limit)} limit used`
    : undefined;

  return [
    {
      label: 'Total owed',
      value: formatBalance(summary, summary.total.balance),
      detail: countLabel(summary.count),
    },
    {
      label: 'Credit cards',
      value: formatBalance(summary, cards?.balance ?? 0),
      detail: used ?? countLabel(cards?.count ?? 0, 'card'),
    },
    {
      label: 'Loans',
      value: formatBalance(summary, loans?.balance ?? 0),
      detail: countLabel(loans?.count ?? 0, 'loan'),
    },
  ];
}

export const CreditAndLoans: React.FC = () => {
  return (
    <AccountsOverview
      heading="Credit and loans"
      description="What you owe across credit cards, lines of credit, and loans."
      groups={GROUPS}
      getSummary={getSummary}
      emptyTitle="No credit or loans yet"
      emptyDescription="Credit cards, lines of credit, and loans from your connections will show up here."
    />
  );
};
