import type { AccountType, NetWorthRange } from '@opulus/core/dto';

/**
 * Query keys for accounts. `all` is the prefix, used to invalidate every
 * accounts query; `list` is one list, optionally limited to some types, and
 * `netWorth` the net worth history for a range.
 */
export const accountKeys = {
  all: ['accounts'] as const,
  list: (types?: AccountType[]) =>
    [...accountKeys.all, types ?? 'all'] as const,
  netWorth: (range: NetWorthRange) =>
    [...accountKeys.all, 'net-worth', range] as const,
};
