import { Receipt } from 'lucide-react';
import * as React from 'react';

import {
  List,
  ListEmpty,
  ListError,
  ListFooter,
  ListGroup,
  ListHeader,
  ListRow,
} from '@/common/List';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui';
import { useActivity } from '@/hooks/investments/useActivity';
import { useOnVisible } from '@/hooks/use-on-visible';
import { resolveRange } from '@/utils/dateRange';
import { formatDay } from '@/utils/day';
import {
  activityIcon,
  activitySubtitle,
  activityTitle,
  formatSignedMoney,
} from '@/utils/investmentDisplay';

import { ACTIVITY_FILTER_KINDS, type InvestmentsSearch } from './searchSchema';

const KIND_LABELS = {
  buy: 'Buys',
  sell: 'Sells',
  dividend: 'Dividends',
  added: 'Money added',
  fee: 'Fees',
} as const;

const ALL_KINDS = 'all';

/** What went in, came out and was earned across the user's investment accounts. */
export const InvestmentActivity: React.FC<{
  search: Pick<InvestmentsSearch, 'account' | 'kind' | 'range'>;
  update: (changes: Partial<InvestmentsSearch>) => void;
}> = ({ search, update }) => {
  // Fixed for the life of the page, so the query key does not change under it.
  const [{ yearStart, twelveMonthsAgo }] = React.useState(() => ({
    yearStart: `${new Date().getFullYear()}-01-01`,
    twelveMonthsAgo: resolveRange('year').start,
  }));
  const startDate =
    search.range === 'all'
      ? undefined
      : search.range === 'year'
        ? yearStart
        : twelveMonthsAgo;

  const list = useActivity({
    accountId: search.account,
    kind: search.kind,
    startDate,
  });
  const items = React.useMemo(
    () => list.data?.pages.flatMap((page) => page.items) ?? [],
    [list.data]
  );
  const total = list.data?.pages[0]?.pagination.total ?? 0;
  const months = React.useMemo(() => groupByMonth(items), [items]);

  const loadMore = () => void list.fetchNextPage();
  const loadFailed = list.isFetchNextPageError;
  const loadMoreRef = useOnVisible<HTMLDivElement>(loadMore, {
    enabled: list.hasNextPage && !list.isFetchingNextPage && !loadFailed,
    rootMargin: '300px',
  });

  return (
    <section aria-label="Activity" className="flex flex-col gap-4">
      <h3 className="text-base font-semibold">Activity</h3>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={search.kind ?? ALL_KINDS}
          onValueChange={(value) => {
            if (!value) return;
            update({
              kind:
                value === ALL_KINDS
                  ? undefined
                  : (value as (typeof ACTIVITY_FILTER_KINDS)[number]),
            });
          }}
          aria-label="Kind"
          className="flex-wrap"
        >
          <ToggleGroupItem value={ALL_KINDS}>All</ToggleGroupItem>
          {ACTIVITY_FILTER_KINDS.map((kind) => (
            <ToggleGroupItem key={kind} value={kind}>
              {KIND_LABELS[kind]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select
          value={search.range ?? '12m'}
          onValueChange={(value) =>
            update({
              range: value === 'year' || value === 'all' ? value : undefined,
            })
          }
        >
          <SelectTrigger size="sm" className="w-40" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="12m">Last 12 months</SelectItem>
            <SelectItem value="year">This year</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <List
        aria-label="Activity"
        isLoading={list.isLoading}
        isRefreshing={list.isPlaceholderData}
      >
        <ListHeader
          title={
            list.isLoading
              ? 'Activity'
              : `${total} ${total === 1 ? 'transaction' : 'transactions'}`
          }
        />
        {list.isError ? (
          <ListError subject="activity" onRetry={() => void list.refetch()} />
        ) : items.length === 0 ? (
          <ListEmpty
            icon={Receipt}
            title="No activity"
            description="Nothing matches. Your institutions report up to 24 months of activity."
          />
        ) : (
          months.map(({ month, items: rows }) => (
            <ListGroup key={month} title={monthLabel(month)}>
              {rows.map((item) => (
                <ListRow
                  key={item.id}
                  icon={activityIcon(item.kind)}
                  title={activityTitle(item)}
                  subtitle={activitySubtitle(item)}
                  trailingTitle={formatSignedMoney(item.amount, item.currency)}
                />
              ))}
            </ListGroup>
          ))
        )}
        {!list.isError && items.length > 0 && (
          <ListFooter
            summary={`Showing ${items.length} of ${total}`}
            action={
              loadFailed ? (
                <Button variant="outline" size="sm" onClick={loadMore}>
                  Try again
                </Button>
              ) : list.hasNextPage ? (
                <div
                  ref={loadMoreRef}
                  role="status"
                  aria-label="Loading more activity"
                  className="size-4"
                >
                  {list.isFetchingNextPage && <Spinner />}
                </div>
              ) : undefined
            }
          />
        )}
      </List>
    </section>
  );
};

const monthLabel = (month: string) =>
  formatDay(`${month}-01`, { month: 'long', year: 'numeric' });

/** Group activity (newest first) by the month it fell in, as `YYYY-MM`. */
function groupByMonth<T extends { date: string }>(
  items: T[]
): { month: string; items: T[] }[] {
  const months: { month: string; items: T[] }[] = [];
  for (const item of items) {
    const month = item.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.month === month) last.items.push(item);
    else months.push({ month, items: [item] });
  }
  return months;
}
