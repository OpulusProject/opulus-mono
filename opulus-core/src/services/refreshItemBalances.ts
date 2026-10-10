import { plaidGateway } from "../gateways/plaidGateway.js";
import { accountRepository } from "../repositories/accountRepository.js";

export interface RefreshItemBalancesParams {
  /** Our id for the item. */
  itemId: string;
  accessToken: string;
}

/**
 * Read an item's balances from its institution now and store them on its
 * accounts, so they are as current as Plaid can make them. Plaid bills each
 * call, which is why this is not part of every sync.
 *
 * @returns How many accounts were updated
 */
export async function refreshItemBalances(
  params: RefreshItemBalancesParams
): Promise<number> {
  const { accounts } = await plaidGateway.getBalances(params.accessToken);

  const ids = await accountRepository.getIdsByProviderAccountIds(
    params.itemId,
    accounts.map((account) => account.account_id)
  );

  let updated = 0;
  for (const account of accounts) {
    const id = ids.get(account.account_id);
    if (!id) continue; // an account that was not shared with us
    await accountRepository.update(id, {
      balanceAvailable: account.balances.available ?? null,
      balanceCurrent: account.balances.current ?? null,
      balanceLimit: account.balances.limit ?? null,
      isoCurrencyCode: account.balances.iso_currency_code ?? null,
      unofficialCurrencyCode: account.balances.unofficial_currency_code ?? null,
    });
    updated += 1;
  }
  return updated;
}
