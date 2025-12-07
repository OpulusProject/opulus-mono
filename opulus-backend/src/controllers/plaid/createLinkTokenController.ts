import { Request, Response, NextFunction } from "express";
import { createLinkToken } from "@/services/plaid/createLinkToken.js";
import { createPlaidUser } from "@/services/plaid/createPlaidUser.js";
import { createLinkSession } from "@/services/linkSession/createLinkSession.js";
import { getUser } from "@/services/user/getUser.js";
import { updateUser } from "@/services/user/updateUser.js";
import { getSession } from "@/services/session/getSession.js";
import { UnauthorizedError } from "@/utils/errors.js";

/**
 * Create a Plaid Link token for the authenticated user
 * POST /api/plaid/link-token
 */
export async function createLinkTokenController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Get authenticated user session
    const session = await getSession(req.headers);
    if (!session?.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const userId = session.user.id;

    // Get user from database
    const user = await getUser(userId);

    // Check if user has a Plaid user token, create one if not
    let userToken = user.plaidUserToken;

    if (!userToken) {
      const plaidUserResponse = await createPlaidUser(userId);
      const { user_token: plaidUserToken, user_id: plaidId } = plaidUserResponse;

      // Update user with Plaid credentials
      await updateUser({
        id: userId,
        plaidId,
        plaidUserToken,
      });

      userToken = plaidUserToken;
    }

    // Create Link token
    const linkTokenResponse = await createLinkToken(userToken, userId);
    const linkToken = linkTokenResponse.link_token;

    // Store link session in database
    await createLinkSession({
      userId,
      linkToken,
    });

    res.status(200).json({
      data: {
        linkToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

