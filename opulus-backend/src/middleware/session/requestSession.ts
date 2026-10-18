import { UnauthorizedError } from "@opulus/core";
import { Response } from "express";
import type { AuthSession } from "./requireSession.js";

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
