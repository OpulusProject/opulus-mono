import type { NextFunction, Request, Response } from "express";
import {
  requireSession,
  requireSessionWithoutTwoFactor,
} from "./requireSession.js";

/**
 * Every route under /api needs a signed-in user who has set up two-factor,
 * unless it is listed here. Paths are relative to /api.
 *
 * This is the one place a route is made public. A route added without thinking
 * about it is protected; to open one on purpose, add it here and say why.
 * (Better Auth's /api/auth/* routes are handled before this guard and have
 * their own allowlist; /health and /ready are outside /api.)
 */
const PUBLIC_ROUTES = new Set<string>([
  // The health check, for the platform and uptime monitors.
  "/healthcheck",
]);

/**
 * Open to a signed-in user who has not set up two-factor: the route that tells
 * the client to send them to do so.
 */
const WITHOUT_TWO_FACTOR = new Set<string>(["/session"]);

/**
 * Default-deny for the API: a request to any /api path needs a session (and
 * two-factor) before the router sees it, unless the path is listed above. That
 * includes a path with no route behind it, which answers 401 to a caller with
 * no session and 404 to one with, so the guard cannot be probed for routes.
 */
export function requireApiSession(req: Request, res: Response, next: NextFunction) {
  if (PUBLIC_ROUTES.has(req.path)) return next();
  const guard = WITHOUT_TWO_FACTOR.has(req.path)
    ? requireSessionWithoutTwoFactor
    : requireSession;
  return guard(req, res, next);
}
