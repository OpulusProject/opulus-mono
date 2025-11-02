import { Request, Response, NextFunction } from "express";
import { auth } from "@/lib/auth.js";

/**
 * Middleware to get the current session from Better Auth
 * Adds session and user to req object if authenticated
 */
export async function getSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as any,
    });

    if (session) {
      (req as any).session = session;
      (req as any).user = session.user;
    }

    next();
  } catch (error) {
    next();
  }
}

/**
 * Middleware to require authentication
 * Returns 401 if user is not authenticated
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
      return res.status(401).json({ error: "Unauthorized" });
    }

    (req as any).session = session;
    (req as any).user = session.user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
