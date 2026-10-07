/**
 * Query keys for Plaid Link tokens: one per item and update mode, or `new` for
 * connecting a new institution.
 */
export const linkTokenKeys = {
  all: ['plaid', 'linkToken'] as const,
  forItem: (itemId: string | undefined, mode: string) =>
    [...linkTokenKeys.all, itemId ?? 'new', mode] as const,
};
