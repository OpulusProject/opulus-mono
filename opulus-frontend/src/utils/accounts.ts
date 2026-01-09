import type { Account, ItemPublicDTO } from '@opulus/core';

/**
 * Calculate total available cash from all items
 * Sums balances from all accounts across all items, excluding credit accounts
 */
export function calculateAvailableCash(items: ItemPublicDTO[]): number {
  if (!items || items.length === 0) {
    return 0;
  }
  const allAccounts = items.flatMap((item) => item.accounts);
  return calculateTotalBalance(allAccounts);
}

/**
 * Calculate credit utilization percentage
 * Sums balances of credit accounts and divides by sum of credit limits
 * @returns Utilization percentage (0-100), or null if no credit accounts or limits
 */
export function calculateCreditUtilization(
  items: ItemPublicDTO[]
): number | null {
  if (!items || items.length === 0) {
    return null;
  }
  const allAccounts = items.flatMap((item) => item.accounts);
  const creditAccounts = allAccounts.filter(
    (account: Account) => account.type === 'credit'
  );

  if (creditAccounts.length === 0) {
    return null;
  }

  // Sum balances of credit accounts (use balanceCurrent, typically negative for credit cards)
  const totalBalance = creditAccounts.reduce(
    (sum: number, account: Account) => {
      // For credit cards, balanceCurrent is typically negative (amount owed)
      // We want the absolute value for utilization calculation
      const balance = account.balanceCurrent ?? 0;
      return sum + Math.abs(balance);
    },
    0
  );

  // Sum credit limits
  // If balanceLimit is not available, fallback to balanceCurrent + balanceAvailable
  const totalLimit = creditAccounts.reduce((sum: number, account: Account) => {
    if (account.balanceLimit !== null && account.balanceLimit !== undefined) {
      return sum + account.balanceLimit;
    }
    // Fallback: calculate limit from balanceCurrent + balanceAvailable
    const balanceCurrent = account.balanceCurrent ?? 0;
    const balanceAvailable = account.balanceAvailable ?? 0;
    const calculatedLimit = balanceCurrent + balanceAvailable;
    return sum + Math.abs(calculatedLimit); // Use absolute value to ensure positive limit
  }, 0);

  // If no limits available, return null
  if (totalLimit === 0) {
    return null;
  }

  // Calculate utilization percentage
  const utilization = (totalBalance / totalLimit) * 100;
  return Math.min(100, Math.max(0, utilization)); // Clamp between 0 and 100
}

/**
 * Calculate total balance from accounts, excluding credit accounts
 * Uses balanceAvailable if available, otherwise falls back to balanceCurrent
 */
export function calculateTotalBalance(accounts: Account[]): number {
  const nonCreditAccounts = accounts.filter(
    (account: Account) => account.type !== 'credit'
  );

  return nonCreditAccounts.reduce((sum: number, account: Account) => {
    // Use balanceAvailable if available, otherwise fall back to balanceCurrent
    const balance = account.balanceAvailable ?? account.balanceCurrent ?? 0;
    return sum + balance;
  }, 0);
}
