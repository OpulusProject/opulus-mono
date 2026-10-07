import { getSession } from "./getSession.js";
import { UnauthorizedError } from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/** The signed-in user's session, as Better Auth returns it. */
export type AuthSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/**
 * Middleware to require authentication.
 * Looks the session up once and keeps it for the rest of the request, so
 * controllers read it with `getRequestSession` instead of looking it up again.
 * Throws UnauthorizedError if the user is not authenticated.
 */
export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const session = await getSession(req.headers);

    if (!session?.user) {
      throw new UnauthorizedError("Authentication required");
    }

    res.locals.session = session;
    next();
  } catch (error) {
    // Pass error to error handling middleware
    next(error);
  }
}

/**
 * Read the session that `requireSession` stored for this request.
 *
 * @throws UnauthorizedError if `requireSession` did not run for this request,
 * so a route that forgot the middleware answers 401 instead of running
 * unauthenticated
 *
 * @example
 * const { user } = getRequestSession(res);
 */
export function getRequestSession(res: Response): AuthSession {
  const session = res.locals.session as AuthSession | undefined;
  if (!session?.user) {
    throw new UnauthorizedError("Authentication required");
  }
  return session;
}
