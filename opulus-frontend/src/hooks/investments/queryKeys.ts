/**
 * Query keys for investments. `all` is the prefix, used to invalidate every
 * investments query; `holdings` is what the user holds (optionally of one
 * account) and `activity` a list of transactions for a set of filters.
 */
export const investmentKeys = {
  all: ['investments'] as const,
  holdings: (params?: object) =>
    [...investmentKeys.all, 'holdings', params ?? 'all'] as const,
  activity: (params?: object) =>
    [...investmentKeys.all, 'activity', params] as const,
};
