import type { AccountDTO } from '@opulus/core/dto';

import { getAccountType } from './accountType';

type BalanceAccount = Pick<
  AccountDTO,
  'type' | 'balanceCurrent' | 'isoCurrencyCode'
>;

/** What one currency's accounts add up to. */
export interface NetWorth {
  currency: string | null;
  cash: number;
  investments: number;
  /** Accounts that are neither cash, investments nor debt. */
  other: number;
  /** Credit cards and loans. Plaid reports these as positive balances. */
  owed: number;
  /** Everything owned minus everything owed. */
  netWorth: number;
}

/**
 * Add up balances into net worth, one entry per currency (currencies are never
 * mixed), in currency-code order. Credit and loan balances are what is owed, so
 * they are subtracted; all other accounts are owned.
 */
export function getNetWorth(accounts: BalanceAccount[]): NetWorth[] {
  const byCurrency = new Map<string | null, NetWorth>();
  for (const account of accounts) {
    const key = account.isoCurrencyCode;
    let totals = byCurrency.get(key);
    if (!totals) {
      totals = {
        currency: key,
        cash: 0,
        investments: 0,
        other: 0,
        owed: 0,
        netWorth: 0,
      };
      byCurrency.set(key, totals);
    }

    const balance = account.balanceCurrent ?? 0;
    switch (getAccountType(account)) {
      case 'depository':
        totals.cash += balance;
        break;
      case 'investment':
        totals.investments += balance;
        break;
      case 'credit':
      case 'loan':
        totals.owed += balance;
        break;
      default:
        totals.other += balance;
    }
  }

  return [...byCurrency.values()]
    .map((totals) => ({
      ...totals,
      netWorth: totals.cash + totals.investments + totals.other - totals.owed,
    }))
    .sort((a, b) => (a.currency ?? '').localeCompare(b.currency ?? ''));
}
