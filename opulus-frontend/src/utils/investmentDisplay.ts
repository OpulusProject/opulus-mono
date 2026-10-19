import type { AllocationKind, HoldingDTO } from '@opulus/core/dto';

import { formatMoney, getAccountTypeLabel } from '@/utils/accountDisplay';

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

/** "TFSA ••7714" for an account's subtype and the end of its number. */
export function accountLabel(account: {
  subtype: string | null;
  mask: string | null;
}): string {
  const type = account.subtype
    ? getAccountTypeLabel({ type: 'investment', subtype: account.subtype })
    : 'Investment';
  return account.mask ? `${type} ••${account.mask}` : type;
}

/** "Wealthsimple TFSA · TFSA ••7714": an account's name, then what kind it is. */
export function accountName(account: {
  name: string;
  subtype: string | null;
  mask: string | null;
}): string {
  return account.subtype
    ? `${account.name} · ${accountLabel(account)}`
    : account.name;
}

/** Whether a change is a gain or a loss, for `ListRow`'s tones; none for no change. */
export function amountTone(
  amount: number | null
): 'positive' | 'negative' | undefined {
  if (!amount) return undefined;
  return amount > 0 ? 'positive' : 'negative';
}

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

/** "+26.8%" or "−3.0%" (a real minus sign, as for money). */
export function formatSignedPercent(fraction: number, digits = 1): string {
  const text = formatPercent(Math.abs(fraction), digits);
  if (fraction > 0) return `+${text}`;
  return fraction < 0 ? `−${text}` : text;
}

/** Text and tint for a gain (green) or a loss (red) badge; none for no change. */
export function gainTone(amount: number): string {
  if (amount > 0) {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  }
  return amount < 0 ? 'bg-destructive/10 text-destructive' : '';
}

/** What a holding is called in a list: its ticker, or "Cash", or its name. */
export function holdingTitle(holding: Pick<HoldingDTO, 'security'>): string {
  const { security } = holding;
  if (security.kind === 'cash') return 'Cash';
  return security.tickerSymbol || security.name || 'Unknown security';
}
