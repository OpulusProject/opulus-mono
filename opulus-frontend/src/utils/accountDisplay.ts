import type { AccountDTO } from '@opulus/core/dto';

// Matches the locale used for dates elsewhere in the app.
const LOCALE = 'en-CA';

const SUBTYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  'credit card': 'Credit card',
  'line of credit': 'Line of credit',
  'home equity': 'Home equity line of credit',
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
  account: Pick<AccountDTO, 'type' | 'subtype'>
): string {
  if (account.subtype) {
    return (
      SUBTYPE_LABELS[account.subtype.toLowerCase()] ??
      titleCase(account.subtype)
    );
  }
  return TYPE_LABELS[account.type] ?? titleCase(account.type);
}

/** Credit still available on a credit account, derived when not provided. */
export function getAvailableCredit(account: AccountDTO): number | null {
  if (account.balanceAvailable !== null) return account.balanceAvailable;
  if (account.balanceLimit !== null && account.balanceCurrent !== null) {
    return account.balanceLimit - account.balanceCurrent;
  }
  return null;
}

/** Secondary balance line shown under an account's main balance. */
export function getBalanceCaption(account: AccountDTO): string | null {
  const currency = account.isoCurrencyCode;

  if (account.type === 'credit') {
    const available = getAvailableCredit(account);
    const limit = getCreditLimit(account);
    if (available !== null && limit !== null) {
      return `${formatMoney(available, currency)} available of ${formatMoney(limit, currency)}`;
    }
    if (available !== null) {
      return `${formatMoney(available, currency)} available`;
    }
    if (limit !== null) {
      return `Limit ${formatMoney(limit, currency)}`;
    }
    return null;
  }

  // Lines of credit (e.g. a HELOC) are loans that report available credit.
  if (
    account.balanceAvailable !== null &&
    account.balanceAvailable !== account.balanceCurrent
  ) {
    return `${formatMoney(account.balanceAvailable, currency)} available`;
  }

  return null;
}

/**
 * Credit limit for a credit account. Plaid sometimes returns only the limit or
 * only the available credit, so derive whichever one is missing.
 */
export function getCreditLimit(account: AccountDTO): number | null {
  if (account.balanceLimit !== null) return account.balanceLimit;
  if (account.balanceAvailable !== null && account.balanceCurrent !== null) {
    return account.balanceCurrent + account.balanceAvailable;
  }
  return null;
}
