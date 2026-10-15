import {
  ACCOUNT_TYPES,
  BASE_CURRENCY,
  accountRepository,
  creditLimitOf,
  fromUnits,
  isOwed,
  loadExchangeRateConverter,
  normalizeAccountType,
  toDay,
  toNumber,
  toUnits,
  type AccountsSummaryResponse,
  type AccountType,
} from "@opulus/core";

export interface GetAccountsSummaryParams {
  userId: string;
  /** Only accounts of these types (all of the user's accounts if omitted). */
  types?: AccountType[];
  /** The current moment; only tests pass it. */
  now?: Date;
}

/** One type's accounts while adding up, in whole units of the base currency. */
interface TypeEntry {
  count: number;
  balance: number;
  limit: number;
  limitedOwed: number;
  hasLimit: boolean;
}

/**
 * What a user's accounts add up to, in the base currency: overall (with net
 * worth) and per type (with credit utilization for credit cards). Each account
 * is converted at the latest stored rate, then added up. Credit and loan
 * balances are what is owed, so net worth subtracts them. Rates are only read when some account is in another currency.
 */
export async function getAccountsSummary(
  params: GetAccountsSummaryParams
): Promise<AccountsSummaryResponse["data"]> {
  const rows = await accountRepository.getAllByUserId(
    params.userId,
    params.types
  );

  const today = toDay(params.now ?? new Date());
  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: rows.map((row) => row.isoCurrencyCode),
    days: [today],
  });

  let assets = 0;
  let owed = 0;
  const byType = new Map<AccountType, TypeEntry>();

  for (const row of rows) {
    const type = normalizeAccountType(row.type);
    const entry = byType.get(type) ?? {
      count: 0,
      balance: 0,
      limit: 0,
      limitedOwed: 0,
      hasLimit: false,
    };
    entry.count += 1;
    byType.set(type, entry);

    const rate = converter.rateOn(row.isoCurrencyCode, today);

    const toBaseUnits = (amount: number) => toUnits(amount * rate);
    const balance = toNumber(row.balanceCurrent);
    if (balance !== null) {
      entry.balance += toBaseUnits(balance);
      if (isOwed(type)) owed += toBaseUnits(balance);
      else assets += toBaseUnits(balance);
    }
    if (type === "credit") {
      const limit = creditLimitOf({
        balanceLimit: toNumber(row.balanceLimit),
        balanceAvailable: toNumber(row.balanceAvailable),
        balanceCurrent: balance,
      });
      if (limit !== null) {
        entry.hasLimit = true;
        entry.limit += toBaseUnits(limit);
        entry.limitedOwed += toBaseUnits(balance ?? 0);
      }
    }
  }

  return {
    baseCurrency: BASE_CURRENCY,
    count: rows.length,
    total: {
      balance: fromUnits(assets + owed),
      assets: fromUnits(assets),
      owed: fromUnits(owed),
      netWorth: fromUnits(assets - owed),
    },
    byType: ACCOUNT_TYPES.flatMap((type) => {
      const entry = byType.get(type);
      if (!entry) return [];
      return {
        type,
        count: entry.count,
        balance: fromUnits(entry.balance),
        credit:
          entry.hasLimit && entry.limit > 0
            ? {
                limit: fromUnits(entry.limit),
                utilization: entry.limitedOwed / entry.limit,
              }
            : null,
      };
    }),
  };
}
