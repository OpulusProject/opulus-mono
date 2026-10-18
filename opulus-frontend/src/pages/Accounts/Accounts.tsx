import {
  type AccountGroupConfig,
  AccountsOverview,
} from '@/common/AccountsOverview';

// Investments, credit cards and loans have their own pages.
const GROUPS: AccountGroupConfig[] = [
  { type: 'depository', title: 'Cash' },
  { type: 'other', title: 'Other' },
];

export const Accounts: React.FC = () => {
  return (
    <AccountsOverview
      heading="Accounts"
      description="Your chequing and savings balances. Investments, cards and loans have their own pages."
      groups={GROUPS}
      emptyTitle="No accounts yet"
      emptyDescription="Add a connection and its checking and savings accounts will show up here."
    />
  );
};
