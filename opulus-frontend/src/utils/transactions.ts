import type { TransactionDTO } from '@opulus/core/dto';

/**
 * Calculate largest spending category from transactions
 * @returns The category name with the highest spending, or null if no spending transactions
 */
export function calculateLargestCategory(
  transactions: TransactionDTO[]
): string | null {
  if (!transactions || transactions.length === 0) {
    return null;
  }

  // Map to sum spending by category
  const categorySpending = new Map<string, number>();

  transactions.forEach((transaction: TransactionDTO) => {
    const amount = transaction.amount;
    // Only include positive amounts (spending)
    if (amount > 0) {
      const category = transaction.category
        ? formatCategory(transaction.category.primary)
        : 'Uncategorized';
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
export function calculateTotalSpending(transactions: TransactionDTO[]): number {
  return transactions.reduce((sum, transaction) => {
    const amount = transaction.amount;
    // Only include positive amounts (money out/spending per Plaid convention)
    if (amount > 0) {
      return sum + amount;
    }
    return sum;
  }, 0);
}

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
