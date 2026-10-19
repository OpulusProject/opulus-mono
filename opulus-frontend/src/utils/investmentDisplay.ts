import type { AllocationKind } from '@opulus/core/dto';

import { formatMoney } from '@/utils/accountDisplay';

/** What the allocation's slices are called. */
export const ALLOCATION_LABELS: Record<AllocationKind, string> = {
  etf: 'ETFs',
  stock: 'Stocks',
  mutualFund: 'Mutual funds',
  bond: 'Bonds',
  option: 'Options',
  cash: 'Cash',
  other: 'Other',
  balance: 'Balance only',
};

/** A gain as the lists show it: "+$402.50 (26.8%)". */
export function formatGain(
  gain: number,
  gainPercent: number | null,
  currencyCode: string | null
): string {
  const amount = formatSignedMoney(gain, currencyCode);
  return gainPercent === null
    ? amount
    : `${amount} (${formatPercent(Math.abs(gainPercent))})`;
}

/** "26.8%". */
export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** "+$402.50" or "−$200.00". */
export function formatSignedMoney(
  amount: number,
  currencyCode: string | null
): string {
  const text = formatMoney(Math.abs(amount), currencyCode);
  if (amount > 0) return `+${text}`;
  return amount < 0 ? `−${text}` : text;
}

/** Text and tint for a gain (green) or a loss (red) badge; none for no change. */
export function gainTone(amount: number): string {
  if (amount > 0) {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  }
  return amount < 0 ? 'bg-destructive/10 text-destructive' : '';
}
