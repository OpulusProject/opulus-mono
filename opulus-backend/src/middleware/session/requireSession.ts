import { getSession } from "./getSession.js";
import {
  config,
  TwoFactorRequiredError,
  UnauthorizedError,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/** The signed-in user's session, as Better Auth returns it. */
export type AuthSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/**
 * Build the middleware that requires a signed-in user. It looks the session up
 * once and keeps it for the rest of the request, so controllers read it with
 * `getRequestSession` instead of looking it up again.
 *
 * With `requireTwoFactor` the user must also have confirmed an authenticator
 * app: every user must, so a session that has not is refused with 403
 * (TWO_FACTOR_REQUIRED) and the client sends them to set it up.
 */
function createRequireSession(options: { requireTwoFactor: boolean }) {
  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      // The default-deny guard (requireApiSession) may have looked it up already.
      const session =
        (res.locals.session as AuthSession | undefined) ??
        (await getSession(req.headers));

      if (!session?.user) {
        throw new UnauthorizedError("Authentication required");
      }
      if (
        options.requireTwoFactor &&
        config.requireTwoFactor &&
        !session.user.twoFactorEnabled
      ) {
        throw new TwoFactorRequiredError();
      }

      res.locals.session = session;
      next();
    } catch (error) {
      // Pass error to error handling middleware
      next(error);
    }
  };
}

/**
 * Middleware to require authentication and two-factor.
 * Throws UnauthorizedError if the user is not authenticated, and
 * TwoFactorRequiredError if they have not set up two-factor.
 */
export const requireSession = createRequireSession({ requireTwoFactor: true });

/**
 * Middleware to require authentication only. For the routes a user who has not
 * set up two-factor yet must still reach: reading their own session, which
 * tells the client that they have to.
 */
export const requireSessionWithoutTwoFactor = createRequireSession({
  requireTwoFactor: false,
});

export { getRequestSession } from "./requestSession.js";
