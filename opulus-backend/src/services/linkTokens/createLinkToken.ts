import {
  AppError,
  linkSessionRepository,
  plaidGateway,
  userRepository,
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

  const user = await userRepository.getById(userId);

  let { plaidUserToken: userToken, plaidId } = user;

  if (!userToken && !plaidId) {
    const plaidUserResponse = await plaidGateway.createUser(userId);
    // Plaid stopped issuing user tokens to integrations created after
    // 2025-12-10; those identify the user by the Plaid user ID instead.
    const { user_token: plaidUserToken, user_id: plaidUserId } =
      plaidUserResponse;

    if (!plaidUserToken && !plaidUserId) {
      throw new AppError(
        "Plaid did not return a user",
        502,
        "PLAID_NO_USER_TOKEN"
      );
    }

    await userRepository.update({
      id: userId,
      plaidId: plaidUserId,
      plaidUserToken: plaidUserToken || undefined,
    });

    userToken = plaidUserToken || null;
    plaidId = plaidUserId;
  }

  const linkTokenResponse = await plaidGateway.createLinkToken(
    userToken ? { userToken } : { plaidUserId: plaidId! },
    userId
  );
  const linkToken = linkTokenResponse.link_token;

  await linkSessionRepository.create({
    userId,
    linkToken,
  });

  return { linkToken };
}
