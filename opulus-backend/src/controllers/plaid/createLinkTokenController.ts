import { getSession } from "@/services/session/getSession.js";
import {
  linkSessionService,
  plaidService,
  UnauthorizedError,
  userService,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Create a Plaid Link token for the authenticated user
 * POST /api/plaid/link-token
 */
export async function createLinkTokenController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Get authenticated user session
    const session = await getSession(req.headers);
    if (!session?.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const userId = session.user.id;

    // Get user from database
    const user = await userService.get(userId);

    // Check if user has a Plaid user token, create one if not
    let userToken = user.plaidUserToken;

    if (!userToken) {
      const plaidUserResponse = await plaidService.createUser(userId);
      const { user_token: plaidUserToken, user_id: plaidId } =
        plaidUserResponse;

      // Update user with Plaid credentials
      await userService.update({
        id: userId,
        plaidId,
        plaidUserToken,
      });

      userToken = plaidUserToken;
    }

    // Create Link token
    const linkTokenResponse = await plaidService.createLinkToken(
      userToken,
      userId
    );
    const linkToken = linkTokenResponse.link_token;

    // Store link session in database
    await linkSessionService.create({
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
