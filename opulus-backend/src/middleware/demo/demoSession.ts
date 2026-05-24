/**
 * Demo Session Middleware
 * Provides a mock session in demo mode (bypasses authentication)
 */

import { Request, Response, NextFunction } from "express";
import { getDemoMode } from "./demoMode.js";

/**
 * Middleware to provide mock session in demo mode
 * Should be used BEFORE requireSession middleware
 */
export function demoSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (getDemoMode(req)) {
    // Set mock session on request
    // This allows controllers to work without real authentication
    (req as any).demoSession = {
      user: {
        id: "demo-user-id",
        email: "demo@opulus.app",
        name: "Demo User",
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "demo-session-id",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    };
  }
  
  next();
}

