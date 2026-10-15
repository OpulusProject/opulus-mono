import type { NetWorthPointDTO, NetWorthRange } from '@opulus/core/dto';
import { Landmark } from 'lucide-react';
import * as React from 'react';

import { List, ListEmpty, ListError } from '@/common/List';
import { Skeleton, ToggleGroup, ToggleGroupItem } from '@/components/ui';
import { useNetWorthHistory } from '@/hooks/accounts/useNetWorthHistory';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/accountDisplay';
import { formatDay } from '@/utils/day';

import { NetWorthChart } from './NetWorthChart';
import { TONE_CLASS, toneOf } from './netWorthTone';

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
  const [range, setRange] = React.useState<NetWorthRange>('1m');
  const history = useNetWorthHistory(range);
  const period = RANGES.find((r) => r.value === range)?.period ?? '';

  if (history.isLoading) return <NetWorthSkeleton />;

  if (!history.data) {
    return (
      <List>
        <ListError
          subject="your net worth"
          onRetry={() => void history.refetch()}
        />
      </List>
    );
  }

  const { baseCurrency, points } = history.data;

  if (points.length === 0) {
    return (
      <List>
        <ListEmpty
          icon={Landmark}
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

      {/* The previous range stays up, dimmed, while the next one loads. */}
      <div
        className={cn(
          'transition-opacity',
          history.isPlaceholderData && 'opacity-60'
        )}
      >
        <NetWorthSummary
          points={points}
          currency={baseCurrency}
          period={period}
        />
      </div>
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

/** The figure, its change over the range, and the line. */
const NetWorthSummary: React.FC<{
  points: NetWorthPointDTO[];
  currency: string;
  period: string;
}> = ({ points, currency, period }) => {
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
