import * as React from 'react';

import { formatMoney } from '@/utils/accountDisplay';

interface EstimatedDividendsLineProps {
  /** For the selected period, in `currency`; null when there is no estimate. */
  amount: number | null;
  currency: string;
}

/**
 * The dividends the holdings should pay over the selected period, under the
 * gain. Nothing for no estimate (all time, or no dividend rate) or for 0.
 */
export const EstimatedDividendsLine: React.FC<EstimatedDividendsLineProps> = ({
  amount,
  currency,
}) => {
  if (!amount) return null;
  return (
    <div className="text-muted-foreground text-xs tabular-nums">
      {formatMoney(amount, currency)} in estimated dividends
    </div>
  );
};
