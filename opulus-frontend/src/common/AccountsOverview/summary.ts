import type {
  AccountType,
  AccountsSummaryResponse,
  AccountsTypeDTO,
} from '@opulus/core/dto';

import { formatMoney } from '@/utils/accountDisplay';

/** What the accounts add up to, as the server works it out. */
export type AccountsSummary = AccountsSummaryResponse['data'];

/** "1 account", "3 accounts". */
export function countLabel(count: number, noun = 'account'): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Says the totals leave out accounts the server could not convert (a currency
 * it has no rate for), or undefined when it left out none.
 */
export function excludedNote(summary: AccountsSummary): string | undefined {
  if (summary.excluded.length === 0) return undefined;
  const currencies = summary.excluded.map((row) => row.currency).join(', ');
  return `Totals don't include accounts in ${currencies}.`;
}

/** An amount from the summary, which is all in one (the base) currency: "$1,000.00". */
export function formatBalance(
  summary: AccountsSummary,
  amount: number
): string {
  return formatMoney(amount, summary.baseCurrency);
}

/** The summary's entry for a type, if there are accounts of it. */
export function typeSummary(
  summary: AccountsSummary,
  type: AccountType
): AccountsTypeDTO | undefined {
  return summary.byType.find((entry) => entry.type === type);
}
