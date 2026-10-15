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
  { type: 'depository', title: 'Cash' },
  { type: 'investment', title: 'Investments' },
  { type: 'other', title: 'Other' },
];

function getSummary(summary: AccountsSummary): SummaryStat[] {
  const cash = typeSummary(summary, 'depository');
  const investments = typeSummary(summary, 'investment');

  return [
    {
      label: 'Total balance',
      value: formatBalance(summary, summary.total.balance),
      detail: countLabel(summary.count),
    },
    {
      label: 'Cash',
      value: formatBalance(summary, cash?.balance ?? 0),
      detail: countLabel(cash?.count ?? 0),
    },
    {
      label: 'Investments',
      value: formatBalance(summary, investments?.balance ?? 0),
      detail: countLabel(investments?.count ?? 0),
    },
  ];
}

export const Accounts: React.FC = () => {
  return (
    <AccountsOverview
      heading="Cash and investments"
      description="Balances across your checking, savings, and investment accounts."
      groups={GROUPS}
      getSummary={getSummary}
      emptyTitle="No accounts yet"
      emptyDescription="Add a connection and its checking, savings, and investment accounts will show up here."
    />
  );
};
