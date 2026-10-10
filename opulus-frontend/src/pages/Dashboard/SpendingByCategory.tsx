import type {
  TransactionsCategorySpendDTO,
  TransactionsSummaryResponse,
} from '@opulus/core/dto';
import { Ellipsis, PiggyBank } from 'lucide-react';
import * as React from 'react';

import { List, ListError, ListGroup, ListHeader, ListRow } from '@/common/List';
import { useAccounts } from '@/hooks/accounts/useAccounts';
import { useTransactionsSummary } from '@/hooks/transactions/useTransactionsSummary';
import { formatMoney } from '@/utils/accountDisplay';
import { toDay } from '@/utils/dateRange';
import { getCategoryIcon, getCategoryLabel } from '@/utils/transactionCategory';

import { DashboardEmpty } from './DashboardEmpty';

/** Categories shown by name; the rest are added up into one row. */
const TOP_CATEGORIES = 5;

type Summary = TransactionsSummaryResponse['data'];

/** This month's spending: the top categories, each with its share of the total. */
export const SpendingByCategory: React.FC = () => {
  // Fixed for the life of the page, so the query key does not change under it.
  const [month] = React.useState(() => {
    const now = new Date();
    return {
      name: now.toLocaleDateString('en-CA', { month: 'long' }),
      startDate: toDay(new Date(now.getFullYear(), now.getMonth(), 1)),
      endDate: toDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  });

  // Transfers and credit card payments would otherwise count as spending twice.
  const summary = useTransactionsSummary({
    startDate: month.startDate,
    endDate: month.endDate,
    hideTransfers: true,
  });
  const accounts = useAccounts();
  const noConnections = accounts.data?.accounts.length === 0;

  const spending = React.useMemo(
    () => (summary.data ? groupSpending(summary.data) : []),
    [summary.data]
  );
  const total = spending
    .map(({ currency, spent }) => formatMoney(spent, currency))
    .join(' + ');

  let content: React.ReactNode;
  if (summary.isError) {
    content = (
      <ListError
        subject="your spending"
        onRetry={() => void summary.refetch()}
      />
    );
  } else if (spending.length === 0) {
    content = (
      <DashboardEmpty
        icon={PiggyBank}
        noConnections={noConnections}
        title="No spending yet"
        description={`Nothing spent so far in ${month.name}.`}
      />
    );
  } else if (spending.length === 1) {
    content = spending[0].rows.map(renderRow);
  } else {
    // Several currencies are never added together, so each gets its own group.
    content = spending.map(({ currency, spent, rows }) => (
      <ListGroup
        key={currency ?? 'none'}
        title={currency ?? 'Other currency'}
        trailingTitle={formatMoney(spent, currency)}
      >
        {rows.map(renderRow)}
      </ListGroup>
    ));
  }

  return (
    <List aria-label="Spending by category" isLoading={summary.isLoading}>
      <ListHeader
        title={`Spending in ${month.name}`}
        trailingTitle={spending.length > 0 ? total : undefined}
      />
      {content}
    </List>
  );
};

interface SpendingRow {
  key: string;
  /** null when Plaid did not categorize; unused on the `more` row. */
  category: string | null | undefined;
  count: number;
  spent: number;
  share: number;
  currency: string | null;
  /** Set on the row that adds up the smaller categories. */
  more?: number;
}

interface CurrencySpending {
  currency: string | null;
  spent: number;
  rows: SpendingRow[];
}

/**
 * The summary as one entry per currency: its total spent and its biggest
 * categories, with the rest added up into a final row.
 */
function groupSpending(summary: Summary): CurrencySpending[] {
  return summary.totals
    .filter((total) => total.spent > 0)
    .map(({ currency, spent }) => {
      const categories = summary.byCategory
        .filter((row) => row.currency === currency && row.spent > 0)
        .sort((a, b) => b.spent - a.spent);
      const toRow = (row: TransactionsCategorySpendDTO): SpendingRow => ({
        key: row.category ?? 'uncategorized',
        category: row.category,
        count: row.count,
        spent: row.spent,
        share: row.spent / spent,
        currency,
      });

      const rows = categories.slice(0, TOP_CATEGORIES).map(toRow);
      const rest = categories.slice(TOP_CATEGORIES);
      if (rest.length > 0) {
        const restSpent = rest.reduce((sum, row) => sum + row.spent, 0);
        rows.push({
          key: 'rest',
          category: undefined,
          count: rest.reduce((sum, row) => sum + row.count, 0),
          spent: restSpent,
          share: restSpent / spent,
          currency,
          more: rest.length,
        });
      }
      return { currency, spent, rows };
    });
}

function renderRow(row: SpendingRow) {
  const label = row.more
    ? `${row.more} other categories`
    : getCategoryLabel(row.category);
  return (
    <ListRow
      key={row.key}
      icon={row.more ? Ellipsis : getCategoryIcon(row.category)}
      title={label}
      subtitle={`${row.count} ${row.count === 1 ? 'transaction' : 'transactions'}`}
      trailingTitle={formatMoney(row.spent, row.currency)}
      trailingSubtitle={`${Math.round(row.share * 100)}%`}
    />
  );
}
