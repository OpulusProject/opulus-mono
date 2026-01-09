import type { Transaction } from '@opulus/core';

/**
 * Calculate largest spending category from transactions
 * Uses the first category if a transaction has multiple categories
 * @returns The category name with the highest spending, or null if no spending transactions
 */
export function calculateLargestCategory(
  transactions: Transaction[]
): string | null {
  if (!transactions || transactions.length === 0) {
    return null;
  }

  // Map to sum spending by category (using first category if multiple)
  const categorySpending = new Map<string, number>();

  transactions.forEach((transaction: Transaction) => {
    const amount = Number(transaction.amount);
    // Only include positive amounts (spending)
    if (amount > 0) {
      const categories = transaction.category || [];
      // Use first category if available
      const category = categories.length > 0 ? categories[0] : 'Uncategorized';
      const current = categorySpending.get(category) || 0;
      categorySpending.set(category, current + amount);
    }
  });

  // Find category with highest spending
  let maxCategory: string | null = null;
  let maxAmount = 0;

  categorySpending.forEach((amount, category) => {
    if (amount > maxAmount) {
      maxAmount = amount;
      maxCategory = category;
    }
  });

  return maxCategory;
}

/**
 * Calculate total spending from transactions
 * Only includes positive amounts (money out/spending per Plaid convention)
 */
export function calculateTotalSpending(transactions: Transaction[]): number {
  return transactions.reduce((sum, transaction) => {
    const amount = Number(transaction.amount);
    // Only include positive amounts (money out/spending per Plaid convention)
    if (amount > 0) {
      return sum + amount;
    }
    return sum;
  }, 0);
}
