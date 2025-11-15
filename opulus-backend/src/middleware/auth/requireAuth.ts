import { auth } from "@/lib/auth";
import { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "@/utils/errors.js";

/**
 * Middleware to require authentication
 * Throws UnauthorizedError if user is not authenticated
 * Adds session and user to req object if authenticated
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as any,
    });

    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    (req as any).session = session;
    (req as any).user = session.user;
    next();
  } catch (error) {
    // If it's already an UnauthorizedError, pass it through
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }
    // For other errors (e.g., network errors), treat as unauthorized
    next(new UnauthorizedError("Authentication failed"));
  }
}
  