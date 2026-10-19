import { getRouteApi } from '@tanstack/react-router';
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
import { Button, Spinner } from '@/components/ui';
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

import { ActivityFilters } from './ActivityFilters';
import { InvestmentsFrame } from './InvestmentsFrame';
import { type ActivitySearch } from './searchSchema';

const route = getRouteApi('/_authenticated/investments/activity');

/** What went in, came out and was earned across the user's investment accounts. */
export const InvestmentActivity: React.FC = () => {
  const search = route.useSearch();
  const navigate = route.useNavigate();

  const update = (changes: Partial<ActivitySearch>) =>
    void navigate({
      search: (previous) =>
        Object.fromEntries(
          Object.entries({ ...previous, ...changes }).filter(
            ([, value]) => value !== undefined
          )
        ),
      replace: true,
    });

  return (
    <InvestmentsFrame
      title="Investments"
      active="activity"
      description="What you put in, took out and earned."
      account={search.account}
      onAccountChange={(account) => update({ account })}
    >
      <ActivityContent search={search} update={update} />
    </InvestmentsFrame>
  );
};

const ActivityContent: React.FC<{
  search: ActivitySearch;
  update: (changes: Partial<ActivitySearch>) => void;
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
    <>
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
          titleAction={
            search.kind || search.range ? (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => update({ kind: undefined, range: undefined })}
              >
                Clear filters
              </Button>
            ) : undefined
          }
          action={({ width }) => (
            <ActivityFilters search={search} width={width} onChange={update} />
          )}
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
    </>
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
