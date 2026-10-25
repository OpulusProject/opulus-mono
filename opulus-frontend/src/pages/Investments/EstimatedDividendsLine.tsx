import * as React from 'react';

import { formatMoney } from '@/utils/accountDisplay';

interface EstimatedDividendsLineProps {
  /** In `currency`; null when there is no estimate. */
  amount: number | null;
  currency: string;
  /** The amount is a whole year's (no date filter), not a filtered period's. */
  perYear: boolean;
}

/**
 * The dividends the holdings should pay, above the gain: a whole year's with no
 * date filter, otherwise the share of it that falls in the selected period.
 * Nothing for no estimate (no dividend rate) or for 0.
 */
export const EstimatedDividendsLine: React.FC<EstimatedDividendsLineProps> = ({
  amount,
  currency,
  perYear,
}) => {
  if (!amount) return null;
  return (
    <div className="text-muted-foreground text-xs tabular-nums">
      Estimated dividends · {formatMoney(amount, currency)}
      {perYear && ' a year'}
    </div>
  );
};
