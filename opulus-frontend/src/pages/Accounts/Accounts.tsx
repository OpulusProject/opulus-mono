import {
  type AccountEntry,
  type AccountGroupConfig,
  AccountsOverview,
  type SummaryStat,
} from '@/common/AccountsOverview';
import { formatTotals } from '@/utils/accountDisplay';
import { getAccountKind } from '@/utils/accountKind';

const GROUPS: AccountGroupConfig[] = [
  { kind: 'cash', title: 'Cash' },
  { kind: 'investment', title: 'Investments' },
  { kind: 'other', title: 'Other' },
];

function countLabel(count: number) {
  return `${count} account${count === 1 ? '' : 's'}`;
}

function getSummary(entries: AccountEntry[]): SummaryStat[] {
  const accounts = entries.map((entry) => entry.account);
  const cash = accounts.filter((a) => getAccountKind(a) === 'cash');
  const investments = accounts.filter(
    (a) => getAccountKind(a) === 'investment'
  );

  return [
    {
      label: 'Total balance',
      value: formatTotals(accounts),
      detail: countLabel(accounts.length),
    },
    {
      label: 'Cash',
      value: formatTotals(cash),
      detail: countLabel(cash.length),
    },
    {
      label: 'Investments',
      value: formatTotals(investments),
      detail: countLabel(investments.length),
    },
  ];
}

export const Accounts: React.FC = () => {
  return (
    <AccountsOverview
      title="Accounts"
      heading="Cash and investments"
      description="Balances across your checking, savings, and investment accounts."
      groups={GROUPS}
      getSummary={getSummary}
      emptyTitle="No accounts yet"
      emptyDescription="Add a connection and its checking, savings, and investment accounts will show up here."
    />
  );
};
