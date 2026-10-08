/**
 * Transaction categories
 */

/**
 * Plaid's personal finance categories, at the high level (`primary`). This is
 * the full set in Plaid's taxonomy today; Plaid may add more, so the API takes
 * and returns category values as plain strings and this list is only for
 * building filter choices.
 * https://plaid.com/documents/transactions-personal-finance-category-taxonomy.csv
 */
export const TRANSACTION_CATEGORIES = [
  "INCOME",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "LOAN_PAYMENTS",
  "BANK_FEES",
  "ENTERTAINMENT",
  "FOOD_AND_DRINK",
  "GENERAL_MERCHANDISE",
  "HOME_IMPROVEMENT",
  "MEDICAL",
  "PERSONAL_CARE",
  "GENERAL_SERVICES",
  "GOVERNMENT_AND_NON_PROFIT",
  "TRANSPORTATION",
  "TRAVEL",
  "RENT_AND_UTILITIES",
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

/**
 * In a `category` filter, matches transactions Plaid did not categorize.
 */
export const UNCATEGORIZED = "UNCATEGORIZED";
