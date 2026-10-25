import * as React from 'react';

import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/accountDisplay';
import { formatSignedMoney, gainTone } from '@/utils/investmentDisplay';

interface DividendsReceivedLineProps {
  /** What was paid out over the selected period, in `currency`. */
  amount: number;
  currency: string;
  /** "since purchase", "past month": the period the amount is over. */
  periodLabel: string;
  /** The gain over the same period in `currency`, when there is one. */
  gain: number | null;
}

// SCRATCH: design variants, picked with ?dv=a..e. Not for merging.
const variant = () =>
  new URLSearchParams(window.location.search).get('dv') ?? 'a';

export const DividendsReceivedLine: React.FC<DividendsReceivedLineProps> = ({
  amount,
  currency,
  periodLabel,
  gain,
}) => {
  const money = formatMoney(amount, currency);
  switch (variant()) {
    case 'b':
      return (
        <div className="text-muted-foreground text-xs">
          <span className="text-foreground font-medium tabular-nums">
            {money}
          </span>{' '}
          paid out in dividends · {periodLabel}
        </div>
      );
    case 'c':
      return (
        <div className="flex items-center gap-2 pt-0.5">
          <Badge
            variant="secondary"
            className={cn('tabular-nums', gainTone(amount))}
          >
            {formatSignedMoney(amount, currency)}
          </Badge>
          <span className="text-muted-foreground text-xs">
            in dividends · {periodLabel}
          </span>
        </div>
      );
    case 'd':
      return (
        <div className="flex items-baseline gap-2 pt-1 text-xs">
          <span className="text-muted-foreground">Dividends</span>
          <span className="text-sm font-medium tabular-nums">{money}</span>
          <span className="text-muted-foreground">{periodLabel}</span>
        </div>
      );
    case 'e':
      return gain === null ? (
        <div className="text-muted-foreground text-xs">
          {money} in dividends · {periodLabel}
        </div>
      ) : (
        <div className="text-muted-foreground text-xs">
          Total return{' '}
          <span className="text-foreground font-medium tabular-nums">
            {formatSignedMoney(gain + amount, currency)}
          </span>{' '}
          including {money} in dividends
        </div>
      );
    default:
      return (
        <div className="text-muted-foreground text-xs tabular-nums">
          Dividends received · {money}
        </div>
      );
  }
};
