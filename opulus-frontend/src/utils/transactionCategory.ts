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
