import type { Account } from '@opulus/core';

/**
 * What an account is for the user: money they hold (cash, investment, other)
 * or money they owe (credit, loan). Plaid's `type` decides it.
 */
export type AccountKind = 'cash' | 'investment' | 'other' | 'credit' | 'loan';

export function getAccountKind(account: Pick<Account, 'type'>): AccountKind {
  switch (account.type) {
    case 'depository':
      return 'cash';
    case 'investment':
    case 'brokerage':
      return 'investment';
    case 'credit':
      return 'credit';
    case 'loan':
      return 'loan';
    default:
      return 'other';
  }
}

/** Credit cards and loans: balances are amounts owed, not funds held. */
export function isLiability(account: Pick<Account, 'type'>): boolean {
  const kind = getAccountKind(account);
  return kind === 'credit' || kind === 'loan';
}
