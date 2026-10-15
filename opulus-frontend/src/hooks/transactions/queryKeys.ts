/**
 * Query keys for transactions. `all` is the prefix, used to invalidate every
 * transactions query; `list` is one list for a set of filters and pagination,
 * and `infinite` the same list read page by page. `spendingByCategory` is the
 * spending breakdown for a set of filters, and `dailyTotals` each day's totals.
 */
export const transactionKeys = {
  all: ['transactions'] as const,
  list: (params?: object) => [...transactionKeys.all, params] as const,
  infinite: (params?: object) =>
    [...transactionKeys.all, 'infinite', params] as const,
  spendingByCategory: (params?: object) =>
    [...transactionKeys.all, 'spending-by-category', params] as const,
  dailyTotals: (params?: object) =>
    [...transactionKeys.all, 'daily-totals', params] as const,
};
