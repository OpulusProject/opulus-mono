import type { Account } from '@opulus/core';

// Matches the locale used for dates elsewhere in the app.
const LOCALE = 'en-CA';

const SUBTYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  'credit card': 'Credit card',
  'line of credit': 'Line of credit',
  'money market': 'Money market',
  'cash management': 'Cash management',
  cd: 'CD',
  hsa: 'HSA',
  paypal: 'PayPal',
  prepaid: 'Prepaid',
  mortgage: 'Mortgage',
  student: 'Student loan',
  auto: 'Auto loan',
  brokerage: 'Brokerage',
  ira: 'IRA',
  '401k': '401(k)',
  rrsp: 'RRSP',
  tfsa: 'TFSA',
};

const TYPE_LABELS: Record<string, string> = {
  depository: 'Deposit account',
  credit: 'Credit card',
  loan: 'Loan',
  investment: 'Investment',
  other: 'Other',
};

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Format a money amount in the account's own currency. Falls back to a plain
 * two-decimal number when the currency is unknown or invalid.
 */
export function formatMoney(
  amount: number | null,
  currencyCode: string | null
): string {
  if (amount === null) return '—';
  if (currencyCode) {
    try {
      return new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency: currencyCode,
      }).format(amount);
    } catch {
      // Unknown currency code; fall through to the plain format.
    }
  }
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Human-friendly account type, preferring the more specific subtype. */
export function getAccountTypeLabel(
  account: Pick<Account, 'type' | 'subtype'>
): string {
  if (account.subtype) {
    return (
      SUBTYPE_LABELS[account.subtype.toLowerCase()] ??
      titleCase(account.subtype)
    );
  }
  return TYPE_LABELS[account.type] ?? titleCase(account.type);
}

/** Secondary balance line shown under an account's main balance. */
export function getBalanceCaption(account: Account): string | null {
  const currency = account.isoCurrencyCode;

  if (account.type === 'credit') {
    if (account.balanceLimit !== null) {
      const available =
        account.balanceAvailable !== null
          ? `${formatMoney(account.balanceAvailable, currency)} available of `
          : 'Limit ';
      return `${available}${formatMoney(account.balanceLimit, currency)}`;
    }
    if (account.balanceAvailable !== null) {
      return `${formatMoney(account.balanceAvailable, currency)} available`;
    }
    return null;
  }

  if (
    account.balanceAvailable !== null &&
    account.balanceAvailable !== account.balanceCurrent
  ) {
    return `${formatMoney(account.balanceAvailable, currency)} available`;
  }

  return null;
}
