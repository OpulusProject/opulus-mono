import type {
  ActivityItemDTO,
  AllocationKind,
  HoldingDTO,
  HoldingKind,
  HoldingsRange,
  HoldingsResponse,
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
import { formatCustomRange } from '@/utils/dateRange';
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

/** The ranges of the investments' date filter, as its menu names them. */
export const RANGE_LABELS: Record<HoldingsRange, string> = {
  day: 'Past day',
  week: 'Past week',
  month: 'Past month',
  year: 'Past year',
  ytd: 'Year to date',
  custom: 'Custom range',
  all: 'All time',
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

/** "0.5209 shares" bought or sold (at most 4 decimals); none for other changes. */
export function activityQuantity(item: ActivityItemDTO): string | undefined {
  if ((item.kind !== 'buy' && item.kind !== 'sell') || item.quantity === null) {
    return undefined;
  }
  const quantity = Number(item.quantity.toFixed(4));
  return `${quantity} ${quantity === 1 ? 'share' : 'shares'}`;
}

/** "Oct 11", or "Oct 11 · Monthly account fee" for a fee or other change. */
export function activitySubtitle(item: ActivityItemDTO): string {
  return [
    formatShortDay(item.date),
    item.kind === 'fee' || item.kind === 'other' ? item.description : null,
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

/** Whether a change is a gain or a loss, for `ListRow`'s tones; none for no change. */
export function amountTone(
  amount: number | null
): 'positive' | 'negative' | undefined {
  if (!amount) return undefined;
  return amount > 0 ? 'positive' : 'negative';
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

/** Text and tint for a gain (green) or a loss (red) badge; none for no change. */
export function gainTone(amount: number): string {
  if (amount > 0) {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  }
  return amount < 0 ? 'bg-destructive/10 text-destructive' : '';
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

/** What a holding is called in a list: its ticker, or "Cash", or its name. */
export function holdingTitle(holding: Pick<HoldingDTO, 'security'>): string {
  const { security } = holding;
  if (security.kind === 'cash') return 'Cash';
  return security.tickerSymbol || security.name || 'Unknown security';
}

/** What a period of payments is called after the amount: "past month", "Oct 1 – Oct 9", "all time". */
export function periodLabel(
  data: Pick<HoldingsResponse['data'], 'range' | 'since' | 'until'>
): string {
  return data.range === 'custom'
    ? rangeTitle(data)
    : rangeTitle(data).toLowerCase();
}

/** The period of a response as a title: "Past month", "Oct 1 – Oct 9", "All time". */
export function rangeTitle({
  range,
  since,
  until,
}: Pick<HoldingsResponse['data'], 'range' | 'since' | 'until'>): string {
  return range === 'custom' && since
    ? formatCustomRange(since, until ?? undefined)
    : RANGE_LABELS[range];
}

/** What a gain is measured over, after it: "since purchase", "past month", "Oct 1 – Oct 9". */
export function sinceLabel(
  data: Pick<HoldingsResponse['data'], 'range' | 'since' | 'until'>
): string {
  if (data.range === 'all') return 'since purchase';
  return data.range === 'custom'
    ? rangeTitle(data)
    : rangeTitle(data).toLowerCase();
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
