import { auth } from "@/lib/auth";
import { NextFunction, Request, Response } from "express";

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