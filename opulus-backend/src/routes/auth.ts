import { Router } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "@/lib/auth.js";

/**
 * Better Auth Routes
 * 
 * Mounts Better Auth handler at /auth
 * 
 * Better Auth automatically provides these endpoints:
 * - POST   /auth/sign-up           - Register new user
 * - POST   /auth/sign-in/email     - Sign in with email/password
 * - POST   /auth/sign-out          - Sign out current user
 * - GET    /auth/session           - Get current session
 * - PATCH  /auth/session           - Update session metadata
 * 
 * 📝 SOURCE OF TRUTH: Bruno collection at bruno/collections/auth/
 */
const router = Router();

// Convert Better Auth handler to Express-compatible middleware
const authHandler = toNodeHandler(auth);

// Mount Better Auth handler
// Errors are passed to Express error handler via next()
router.use((req, res, next) => {
  authHandler(req, res).catch((err: Error) => {
    next(err); // Pass errors to global error handler
  });
});

export default router;
