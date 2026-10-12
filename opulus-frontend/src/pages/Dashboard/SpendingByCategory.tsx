import type { SpendingCurrencyDTO } from '@opulus/core/dto';
import { Link } from '@tanstack/react-router';
import { Ellipsis, PiggyBank } from 'lucide-react';
import * as React from 'react';

import {
  List,
  ListEmpty,
  ListError,
  ListGroup,
  ListHeader,
  ListRow,
} from '@/common/List';
import { Button } from '@/components/ui';
import { useSpendingByCategory } from '@/hooks/transactions/useSpendingByCategory';
import { formatMoney } from '@/utils/accountDisplay';
import { toDay } from '@/utils/dateRange';
import { getCategoryIcon, getCategoryLabel } from '@/utils/transactionCategory';

/** Categories shown by name; the server adds the rest up into one row. */
const TOP_CATEGORIES = 5;

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
  const query = useSpendingByCategory({
    startDate: month.startDate,
    endDate: month.endDate,
    hideTransfers: true,
    top: TOP_CATEGORIES,
  });
  const spending = query.data?.spending ?? [];

  return (
    <List aria-label="Spending by category" isLoading={query.isLoading}>
      <ListHeader
        title={`Spending in ${month.name}`}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/spending">View breakdown</Link>
          </Button>
        }
      />
      {query.isError ? (
        <ListError
          subject="your spending"
          onRetry={() => void query.refetch()}
        />
      ) : spending.length === 0 ? (
        <ListEmpty
          icon={PiggyBank}
          title="No spending yet"
          description={`Nothing spent so far in ${month.name}.`}
        />
      ) : spending.length === 1 ? (
        categoryRows(spending[0])
      ) : (
        // Several currencies are never added together, so each gets its own group.
        spending.map((entry) => (
          <ListGroup
            key={entry.currency ?? 'none'}
            title={entry.currency ?? 'Other currency'}
            trailingTitle={formatMoney(entry.spent, entry.currency)}
          >
            {categoryRows(entry)}
          </ListGroup>
        ))
      )}
    </List>
  );
};

/**
 * A row per category, then one for the categories the server added up. A list's
 * rows must be its direct children, so this returns them rather than being a
 * component.
 */
function categoryRows({ currency, categories, other }: SpendingCurrencyDTO) {
  const subtitle = (count: number) =>
    `${count} ${count === 1 ? 'transaction' : 'transactions'}`;
  const share = (value: number) => `${Math.round(value * 100)}%`;

  return [
    ...categories.map((row) => (
      <ListRow
        key={row.category ?? 'uncategorized'}
        icon={getCategoryIcon(row.category)}
        title={getCategoryLabel(row.category)}
        subtitle={subtitle(row.count)}
        trailingTitle={formatMoney(row.spent, currency)}
        trailingSubtitle={share(row.share)}
      />
    )),
    other && (
      <ListRow
        key="other"
        icon={Ellipsis}
        title={`${other.categories} other categories`}
        subtitle={subtitle(other.count)}
        trailingTitle={formatMoney(other.spent, currency)}
        trailingSubtitle={share(other.share)}
      />
    ),
  ];
}
