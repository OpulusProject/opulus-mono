import * as React from 'react';

import { formatMoney } from '@/utils/accountDisplay';

interface DividendsReceivedLineProps {
  /** What was paid out over the selected period, in `currency`. */
  amount: number;
  currency: string;
}

/**
 * The dividends actually paid out over the selected period, under the gain.
 * Shown at 0 too: a period with no payment is an answer, not a missing figure.
 */
export const DividendsReceivedLine: React.FC<DividendsReceivedLineProps> = ({
  amount,
  currency,
}) => (
  <div className="text-muted-foreground text-xs tabular-nums">
    Dividends received · {formatMoney(amount, currency)}
  </div>
);
