import { runInTransaction } from "../client/transaction.js";
import { plaidGateway } from "../gateways/plaidGateway.js";
import {
  accountRepository,
  normalizePlaidAccount,
} from "../repositories/accountRepository.js";
import { logger } from "../utils/logger.js";

/** The parts of an item an accounts sync needs. */
interface SyncableItem {
  id: string;
  userId: string;
  accessToken: string;
}

export interface SyncItemAccountsResult {
  /** Accounts Plaid reports that we did not have. */
  created: number;
  /** Accounts we had, refreshed from what Plaid reports. */
  updated: number;
  /** Accounts we had that Plaid no longer reports, deleted with their data. */
  removed: number;
  /** How many accounts Plaid reported. */
  reported: number;
}

/**
 * Bring an item's accounts in line with what Plaid shares now (`/accounts/get`):
 * accounts Plaid reports that we do not have are added, ones we have are
 * refreshed, and ones we have that Plaid no longer reports are deleted, with
 * everything stored for them (the user stopped sharing them: Plaid says the
 * data of accounts that are no longer shared should be removed).
 *
 * Plaid's account ids can change across item updates, so an account is matched
 * by Plaid's account id and, failing that, by its persistent id, and a matched
 * account's stored id is brought up to date. Nothing is deleted when Plaid
 * reported no accounts, or when none of the reported accounts is one of ours:
 * both look like an error or every id changing, not a user de-selecting, so it
 * logs a warning and leaves the data.
 *
 * Shared by the backend (after an update-mode Link session) and the webhooks
 * service, which is why it lives in core.
 *
 * @throws AppError if Plaid or the database fails
 */
export async function syncItemAccounts(params: {
  item: SyncableItem;
}): Promise<SyncItemAccountsResult> {
  const { item } = params;
  const { accounts: reported } = await plaidGateway.getAccounts(
    item.accessToken
  );

  let created = 0;
  let updated = 0;
  let removed = 0;

  await runInTransaction(async (tx) => {
    const existing = await accountRepository.getForReconcile(item.id, tx);
    const matched = new Set<string>();

    for (const plaidAccount of reported) {
      const data = normalizePlaidAccount(plaidAccount, item.id, item.userId);
      const known =
        existing.find((a) => a.providerAccountId === data.providerAccountId) ??
        (data.persistentAccountId
          ? existing.find(
              (a) =>
                !matched.has(a.id) &&
                a.persistentAccountId === data.persistentAccountId
            )
          : undefined);

      if (!known) {
        await accountRepository.create(data, tx);
        created += 1;
        continue;
      }
      matched.add(known.id);
      await accountRepository.update(
        known.id,
        {
          // Plaid's id for the account can change; keep ours current.
          providerAccountId: data.providerAccountId,
          name: data.name,
          officialName: data.officialName,
          type: data.type,
          subtype: data.subtype,
          mask: data.mask,
          balanceAvailable: data.balanceAvailable,
          balanceCurrent: data.balanceCurrent,
          balanceLimit: data.balanceLimit,
          isoCurrencyCode: data.isoCurrencyCode,
          unofficialCurrencyCode: data.unofficialCurrencyCode,
          persistentAccountId: data.persistentAccountId,
        },
        tx
      );
      updated += 1;
    }

    const gone = existing.filter((a) => !matched.has(a.id));
    if (gone.length === 0) return;
    if (reported.length > 0 && matched.size > 0) {
      removed = await accountRepository.deleteByIds(
        gone.map((a) => a.id),
        tx
      );
    } else {
      logger.warn(
        {
          item_id: item.id,
          accounts_known: existing.length,
          accounts_from_plaid: reported.length,
        },
        "Plaid's accounts matched none of ours; not removing any"
      );
    }
  });

  return { created, updated, removed, reported: reported.length };
}
