import type {
  ActivityItemDTO,
  AllocationKind,
  HoldingDTO,
  HoldingKind,
} from '@opulus/core/dto';
import {
  Banknote,
  CircleDollarSign,
  type LucideIcon,
  Receipt,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { formatMoney, getAccountTypeLabel } from '@/utils/accountDisplay';
import { formatDay } from '@/utils/day';

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

export const KIND_LABELS: Record<HoldingKind, string> = {
  etf: 'ETF',
  stock: 'Stock',
  mutualFund: 'Mutual fund',
  bond: 'Bond',
  option: 'Option',
  cash: 'Cash',
  other: 'Other',
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

export function activityIcon(kind: ActivityItemDTO['kind']): LucideIcon {
  return ACTIVITY_ICONS[kind] ?? CircleDollarSign;
}

/** "10 shares at $33.80 · Wealthsimple TFSA ••7714". */
export function activitySubtitle(item: ActivityItemDTO): string {
  const trade =
    (item.kind === 'buy' || item.kind === 'sell') &&
    item.quantity !== null &&
    item.price !== null
      ? `${item.quantity} ${item.quantity === 1 ? 'share' : 'shares'} at ${formatMoney(item.price, item.currency)}`
      : item.kind === 'fee' || item.kind === 'other'
        ? item.description
        : null;
  return [
    formatShortDay(item.date),
    trade,
    [
      item.institutionName,
      accountLabel({ subtype: item.accountSubtype, mask: item.accountMask }),
    ]
      .filter(Boolean)
      .join(' '),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Bought XEQT", "Dividend from XIC", "Added to TFSA". */
export function activityTitle(item: ActivityItemDTO): string {
  const security =
    item.security?.tickerSymbol || item.security?.name || 'a security';
  switch (item.kind) {
    case 'buy':
      return `Bought ${security}`;
    case 'sell':
      return `Sold ${security}`;
    case 'dividend':
      return item.security ? `Dividend from ${security}` : 'Interest';
    case 'added':
      return `Added to ${item.accountSubtype ? getAccountTypeLabel({ type: 'investment', subtype: item.accountSubtype }) : item.accountName}`;
    case 'removed':
      return `Taken out of ${item.accountSubtype ? getAccountTypeLabel({ type: 'investment', subtype: item.accountSubtype }) : item.accountName}`;
    case 'fee':
      return 'Fee';
    default:
      return item.description;
  }
}

/** Whole days from now until an ISO date (negative once it has passed). */
export function daysUntil(iso: string, now = new Date()): number {
  return Math.ceil((Date.parse(iso) - now.getTime()) / (24 * 60 * 60 * 1000));
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

/** "Oct 15, 2026" for an ISO date. */
export function formatLongDay(iso: string): string {
  return formatDay(iso, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "26.8%". */
export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** "Oct 15" for an ISO date. */
export function formatShortDay(iso: string): string {
  return formatDay(iso, { month: 'short', day: 'numeric' });
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

const ACTIVITY_ICONS: Record<ActivityItemDTO['kind'], LucideIcon> = {
  buy: TrendingUp,
  sell: TrendingDown,
  dividend: Banknote,
  added: Wallet,
  removed: Wallet,
  fee: Receipt,
  other: RefreshCw,
};

/** Text colour for a gain or loss; none for no change. */
export function gainTone(amount: number): string {
  if (amount > 0) return 'text-emerald-600 dark:text-emerald-400';
  return amount < 0 ? 'text-destructive' : '';
}

/** What a holding is called in a list: its ticker, or "Cash", or its name. */
export function holdingTitle(holding: Pick<HoldingDTO, 'security'>): string {
  const { security } = holding;
  if (security.kind === 'cash') return 'Cash';
  return security.tickerSymbol || security.name || 'Unknown security';
}

/** "3 years, 7 months" until an ISO date, or "Matured". */
export function timeUntil(iso: string, now = new Date()): string {
  const target = new Date(iso);
  let months =
    (target.getUTCFullYear() - now.getUTCFullYear()) * 12 +
    (target.getUTCMonth() - now.getUTCMonth());
  if (target.getUTCDate() < now.getUTCDate()) months -= 1;
  if (months <= 0) return daysUntil(iso, now) > 0 ? 'Under a month' : 'Matured';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const part = (n: number, unit: string) =>
    n > 0 ? `${n} ${unit}${n === 1 ? '' : 's'}` : '';
  return [part(years, 'year'), part(rest, 'month')].filter(Boolean).join(', ');
}
