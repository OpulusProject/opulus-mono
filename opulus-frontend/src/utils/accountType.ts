import type { Account, BankAccountType } from '@opulus/core';

/**
 * An account's type for grouping: Plaid's own `type`, with the deprecated
 * `brokerage` folded into `investment` and anything unrecognized as `other`.
 */
export function getAccountType(
  account: Pick<Account, 'type'>
): BankAccountType {
  switch (account.type) {
    case 'depository':
    case 'credit':
    case 'loan':
    case 'investment':
      return account.type;
    case 'brokerage':
      return 'investment';
    default:
      return 'other';
  }
}
