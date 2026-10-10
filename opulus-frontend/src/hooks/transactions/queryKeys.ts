/**
 * Query keys for transactions. `all` is the prefix, used to invalidate every
 * transactions query; `list` is one list for a set of filters and pagination,
 * and `infinite` the same list read page by page. `summary` is the totals for
 * a set of filters.
 */
export const transactionKeys = {
  all: ['transactions'] as const,
  list: (params?: object) => [...transactionKeys.all, params] as const,
  infinite: (params?: object) =>
    [...transactionKeys.all, 'infinite', params] as const,
  summary: (params?: object) =>
    [...transactionKeys.all, 'summary', params] as const,
};
