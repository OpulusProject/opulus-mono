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
