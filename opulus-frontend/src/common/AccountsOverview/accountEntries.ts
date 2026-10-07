import type { Account, ItemPublicDTO } from '@opulus/core';

/** An account together with the connection (item) it comes from. */
export interface AccountEntry {
  account: Account;
  item: ItemPublicDTO;
}

export function toAccountEntries(items: ItemPublicDTO[]): AccountEntry[] {
  return items.flatMap((item) =>
    item.accounts.map((account) => ({ account, item }))
  );
}
