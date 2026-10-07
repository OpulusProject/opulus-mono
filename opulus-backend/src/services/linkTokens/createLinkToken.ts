import {
  linkSessionService,
  plaidService,
  userService,
} from "@opulus/core";

export interface CreateLinkTokenParams {
  userId: string;
}

export interface CreateLinkTokenResult {
  linkToken: string;
}

/**
 * Create a Plaid Link token for connecting a new institution.
 *
 * Plaid needs a user token for the user, so the first time a user connects
 * anything one is created and stored on them. The Link session is recorded so
 * the token can be matched up later.
 */
export async function createLinkToken(
  params: CreateLinkTokenParams
): Promise<CreateLinkTokenResult> {
  const { userId } = params;

  const user = await userService.get(userId);

  let userToken = user.plaidUserToken;

  if (!userToken) {
    const plaidUserResponse = await plaidService.createUser(userId);
    const { user_token: plaidUserToken, user_id: plaidId } = plaidUserResponse;

    await userService.update({
      id: userId,
      plaidId,
      plaidUserToken,
    });

    userToken = plaidUserToken;
  }

  const linkTokenResponse = await plaidService.createLinkToken(
    userToken,
    userId
  );
  const linkToken = linkTokenResponse.link_token;

  await linkSessionService.create({
    userId,
    linkToken,
  });

  return { linkToken };
}
