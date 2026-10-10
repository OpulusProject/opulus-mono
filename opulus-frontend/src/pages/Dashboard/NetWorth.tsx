import type { NetWorthRange, NetWorthSeriesDTO } from '@opulus/core/dto';
import { Landmark } from 'lucide-react';
import * as React from 'react';

import { List, ListError } from '@/common/List';
import {
  Button,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui';
import { useAccounts } from '@/hooks/accounts/useAccounts';
import { useNetWorthHistory } from '@/hooks/accounts/useNetWorthHistory';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/accountDisplay';
import { formatDay } from '@/utils/day';
import { type NetWorth as NetWorthTotals, getNetWorth } from '@/utils/netWorth';

import { DashboardEmpty } from './DashboardEmpty';
import { NetWorthChart } from './NetWorthChart';
import { TONE_CLASS, toneOf } from './netWorthTone';

/** "$1,000.00", or "$1,000.00 + US$50.00" when the accounts span currencies. */
const format = (
  totals: NetWorthTotals[],
  pick: (total: NetWorthTotals) => number
) => totals.map((t) => formatMoney(pick(t), t.currency)).join(' + ');

const RANGES: { value: NetWorthRange; label: string; period: string }[] = [
  { value: '1w', label: '1W', period: 'past week' },
  { value: '1m', label: '1M', period: 'past month' },
  { value: '3m', label: '3M', period: 'past 3 months' },
  { value: '1y', label: '1Y', period: 'past year' },
  { value: 'all', label: 'All', period: 'all time' },
];

/**
 * Net worth (everything owned minus everything owed) and how it has moved: the
 * figure, its change over a range you choose, and a line you can move along to
 * see any day.
 */
export const NetWorth: React.FC = () => {
  const accounts = useAccounts();
  const [range, setRange] = React.useState<NetWorthRange>('1m');
  const history = useNetWorthHistory(range);
  const period = RANGES.find((r) => r.value === range)?.period ?? '';

  const totals = React.useMemo(
    () => getNetWorth(accounts.data?.accounts ?? []),
    [accounts.data]
  );

  if (accounts.isLoading) return <NetWorthSkeleton />;

  if (accounts.isError) {
    return (
      <List>
        <ListError
          subject="your balances"
          onRetry={() => void accounts.refetch()}
        />
      </List>
    );
  }

  if (totals.length === 0) {
    return (
      <List>
        <DashboardEmpty
          icon={Landmark}
          noConnections
          title="No accounts yet"
          description="Connect an account to see your net worth."
        />
      </List>
    );
  }

  return (
    <section aria-label="Net worth" className="rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground text-xs">Net worth</div>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={range}
          // A range stays chosen: clicking it again does not clear it.
          onValueChange={(value) => value && setRange(value as NetWorthRange)}
          aria-label="Range"
        >
          {RANGES.map((r) => (
            <ToggleGroupItem
              key={r.value}
              value={r.value}
              aria-label={r.period}
            >
              {r.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {history.data ? (
        <div
          className={cn(
            'flex flex-col gap-6 transition-opacity',
            history.isPlaceholderData && 'opacity-60'
          )}
        >
          {history.data.series.map((series) => (
            <NetWorthSeries
              key={series.currency ?? 'none'}
              series={series}
              period={period}
              showCurrency={history.data.series.length > 1}
            />
          ))}
        </div>
      ) : (
        <>
          {/* The figure is known before the history is: the accounts add up to it. */}
          <Figure value={format(totals, (t) => t.netWorth)} />
          {history.isError ? (
            <div className="text-muted-foreground mt-3 flex items-center gap-3 text-sm">
              Couldn&apos;t load the history.
              <Button
                variant="outline"
                size="sm"
                onClick={() => void history.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : (
            <Skeleton className="mt-3 h-40 w-full" />
          )}
        </>
      )}
    </section>
  );
};

const Figure: React.FC<{ value: string }> = ({ value }) => (
  <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums break-words sm:text-3xl">
    {value}
  </div>
);

const percent = new Intl.NumberFormat('en-CA', {
  style: 'percent',
  maximumFractionDigits: 1,
});

/** One currency's figure, its change, and its line. */
const NetWorthSeries: React.FC<{
  series: NetWorthSeriesDTO;
  period: string;
  /** Name the currency, when there is more than one line. */
  showCurrency: boolean;
}> = ({ series, period, showCurrency }) => {
  const { currency, points } = series;
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const last = points.length - 1;
  const start = points[0]?.netWorth ?? 0;
  const shown = points[activeIndex ?? last];
  if (!shown) return null;

  // The change is from where the range started to the day being looked at.
  const change = shown.netWorth - start;
  const tone = toneOf(change);
  const rangeTone = toneOf((points[last]?.netWorth ?? 0) - start);
  const changeText =
    tone === 'flat'
      ? 'No change'
      : `${change > 0 ? '+' : '−'}${formatMoney(Math.abs(change), currency)}${
          start !== 0 ? ` (${percent.format(Math.abs(change / start))})` : ''
        }`;

  return (
    <div>
      {showCurrency && (
        <div className="text-muted-foreground mt-2 text-xs">{currency}</div>
      )}
      <Figure value={formatMoney(shown.netWorth, currency)} />
      <div
        className="mt-0.5 flex flex-wrap gap-x-2 text-xs"
        aria-live={activeIndex === null ? 'off' : 'polite'}
      >
        <span className={cn('font-medium tabular-nums', TONE_CLASS[tone])}>
          {changeText}
        </span>
        <span className="text-muted-foreground">
          {activeIndex === null ? period : formatDay(shown.date)}
        </span>
      </div>

      {points.length < 2 ? (
        <p className="text-muted-foreground mt-3 text-sm">
          The history builds up as the days go by.
        </p>
      ) : (
        <div className="mt-3">
          <NetWorthChart
            points={points}
            tone={rangeTone}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
            label={`Net worth over the ${period}, from ${formatMoney(start, currency)} to ${formatMoney(points[last]?.netWorth ?? 0, currency)}. Use the arrow keys to look at each day.`}
          />
        </div>
      )}
    </div>
  );
};

const NetWorthSkeleton: React.FC = () => (
  <div
    aria-busy
    aria-label="Loading net worth"
    className="space-y-3 rounded-md border p-4"
  >
    <div className="space-y-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-8 w-40" />
    </div>
    <Skeleton className="h-40 w-full" />
  </div>
);
