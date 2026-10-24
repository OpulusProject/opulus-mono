import type { TransactionCategory } from '@opulus/core/dto';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Briefcase,
  Car,
  CircleHelp,
  Clapperboard,
  Hammer,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  type LucideIcon,
  Plane,
  Receipt,
  ShoppingBag,
  Sparkles,
  Utensils,
} from 'lucide-react';

/** The lucide icon for each category; every category has its own. */
const CATEGORY_ICONS: Record<TransactionCategory, LucideIcon> = {
  INCOME: Banknote,
  TRANSFER_IN: ArrowDownLeft,
  TRANSFER_OUT: ArrowUpRight,
  LOAN_PAYMENTS: HandCoins,
  BANK_FEES: Receipt,
  ENTERTAINMENT: Clapperboard,
  FOOD_AND_DRINK: Utensils,
  GENERAL_MERCHANDISE: ShoppingBag,
  HOME_IMPROVEMENT: Hammer,
  MEDICAL: HeartPulse,
  PERSONAL_CARE: Sparkles,
  GENERAL_SERVICES: Briefcase,
  GOVERNMENT_AND_NON_PROFIT: Landmark,
  TRANSPORTATION: Car,
  TRAVEL: Plane,
  RENT_AND_UTILITIES: House,
};

/**
 * One colour for each category, so a category looks the same wherever it
 * appears. The Okabe-Ito set, made to stay apart for colour-blind viewers,
 * extended with lighter and darker steps for the rest; the categories most
 * often in the top rows get the most distinct hues. Uncategorized is grey.
 */
const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  FOOD_AND_DRINK: '#E69F00',
  RENT_AND_UTILITIES: '#0072B2',
  GENERAL_MERCHANDISE: '#009E73',
  TRANSPORTATION: '#D55E00',
  ENTERTAINMENT: '#CC79A7',
  TRAVEL: '#56B4E9',
  MEDICAL: '#C0392B',
  HOME_IMPROVEMENT: '#8C6D1F',
  PERSONAL_CARE: '#F0A8D0',
  GENERAL_SERVICES: '#2E5E8C',
  LOAN_PAYMENTS: '#5B4B8A',
  BANK_FEES: '#7A8B2E',
  GOVERNMENT_AND_NON_PROFIT: '#4FB5A5',
  INCOME: '#2F9E44',
  TRANSFER_IN: '#9AA5B1',
  TRANSFER_OUT: '#6B7785',
};

/** The colour for anything without a category of its own. */
const UNCATEGORIZED_COLOR = '#8A94A6';

/**
 * The order categories are listed in when no amount decides it (a legend, a
 * filter): everyday spending first, then fixed costs, then money moving.
 */
export const CATEGORY_ORDER: TransactionCategory[] = [
  'FOOD_AND_DRINK',
  'GENERAL_MERCHANDISE',
  'TRANSPORTATION',
  'ENTERTAINMENT',
  'TRAVEL',
  'PERSONAL_CARE',
  'MEDICAL',
  'HOME_IMPROVEMENT',
  'GENERAL_SERVICES',
  'RENT_AND_UTILITIES',
  'LOAN_PAYMENTS',
  'BANK_FEES',
  'GOVERNMENT_AND_NON_PROFIT',
  'INCOME',
  'TRANSFER_IN',
  'TRANSFER_OUT',
];

/**
 * Turn a Plaid category such as FOOD_AND_DRINK into "Food and Drink"
 */
export function formatCategory(category: string): string {
  return category
    .toLowerCase()
    .split('_')
    .map((word, i) =>
      i > 0 && word === 'and'
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
}

/** The colour for a category, grey for an unknown or missing one. */
export function getCategoryColor(category: string | null | undefined) {
  return (
    CATEGORY_COLORS[category as TransactionCategory] ?? UNCATEGORIZED_COLOR
  );
}

/** The icon for a category, or a question mark for an unknown or missing one. */
export function getCategoryIcon(category: string | null | undefined) {
  return CATEGORY_ICONS[category as TransactionCategory] ?? CircleHelp;
}

/** "Food and Drink", or "Uncategorized" when there is no category. */
export function getCategoryLabel(category: string | null | undefined) {
  return category && category !== 'UNCATEGORIZED'
    ? formatCategory(category)
    : 'Uncategorized';
}
