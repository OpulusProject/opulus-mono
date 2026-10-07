import { plaidService } from "@opulus/core";

import { getOwnedItem } from "../items/getOwnedItem.js";

/**
 * What the update-mode Link session is for: `reconnect` repairs the connection,
 * `add-accounts` also lets the user share accounts that appeared since they
 * linked it.
 */
export type UpdateLinkTokenMode = "reconnect" | "add-accounts";

export interface CreateUpdateLinkTokenParams {
  userId: string;
  itemId: string;
  mode: UpdateLinkTokenMode;
}

export interface CreateUpdateLinkTokenResult {
  linkToken: string;
}

/**
 * Create a Plaid Link token in update mode for one of the user's items.
 *
 * @throws NotFoundError if there is no such item
 * @throws UnauthorizedError if the item belongs to another user
 */
export async function createUpdateLinkToken(
  params: CreateUpdateLinkTokenParams
): Promise<CreateUpdateLinkTokenResult> {
  const item = await getOwnedItem(params);

  const linkTokenResponse = await plaidService.createUpdateLinkToken(
    item.accessToken,
    params.userId,
    { selectAccounts: params.mode === "add-accounts" }
  );

  return { linkToken: linkTokenResponse.link_token };
}
