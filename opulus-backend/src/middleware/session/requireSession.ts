import { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "@opulus/core";
import { getSession } from "@/services/session/getSession.js";
import { getDemoMode } from "@/middleware/demo/demoMode.js";

/**
 * Middleware to require authentication
 * In demo mode, always passes (getSession returns mock session)
 * Throws UnauthorizedError if user is not authenticated (non-demo mode)
 * Controllers should call getSession(req.headers, getDemoMode(req)) directly if they need session data
 */
export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const isDemo = getDemoMode(req);
    const session = await getSession(req.headers, isDemo);

    if (!session && !isDemo) {
      throw new UnauthorizedError("Authentication required");
    }

    next();
  } catch (error) {
    // Pass error to error handling middleware
    next(error);
  }
}
