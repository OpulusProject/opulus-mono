import type { AccountDTO } from '@opulus/core/dto';

import { getAccountType } from './accountType';

type BalanceAccount = Pick<
  AccountDTO,
  'type' | 'balanceCurrent' | 'isoCurrencyCode'
>;

/** What one currency's accounts add up to. */
export interface NetWorth {
  currency: string | null;
  /** Everything owned minus everything owed. */
  netWorth: number;
}

/**
 * Add up balances into net worth, one entry per currency (currencies are never
 * mixed), in currency-code order. Credit and loan balances are what is owed
 * (Plaid reports them as positive), so they are subtracted; all other accounts
 * are owned.
 */
export function getNetWorth(accounts: BalanceAccount[]): NetWorth[] {
  const byCurrency = new Map<string | null, number>();
  for (const account of accounts) {
    const balance = account.balanceCurrent ?? 0;
    const type = getAccountType(account);
    const signed = type === 'credit' || type === 'loan' ? -balance : balance;
    byCurrency.set(
      account.isoCurrencyCode,
      (byCurrency.get(account.isoCurrencyCode) ?? 0) + signed
    );
  }

  return [...byCurrency.entries()]
    .map(([currency, netWorth]) => ({ currency, netWorth }))
    .sort((a, b) => (a.currency ?? '').localeCompare(b.currency ?? ''));
}
