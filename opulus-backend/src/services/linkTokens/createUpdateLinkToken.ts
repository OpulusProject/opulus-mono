import { plaidGateway } from "@opulus/core";

import { getItem } from "../items/getItem.js";

/**
 * What the update-mode Link session is for: `reconnect` repairs the connection,
 * `add-accounts` opens Link's account selection so the user can choose which
 * accounts to share (adding new ones, or removing ones they uncheck).
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
  const item = await getItem(params);

  const linkTokenResponse = await plaidGateway.createUpdateLinkToken(
    item.accessToken,
    params.userId,
    { selectAccounts: params.mode === "add-accounts" }
  );

  return { linkToken: linkTokenResponse.link_token };
}
