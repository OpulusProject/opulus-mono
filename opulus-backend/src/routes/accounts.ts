import {
  getAccountsController,
  getAccountsQuerySchema,
} from "@/controllers/accounts/getAccountsController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { validateQuery } from "@/middleware/validation.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * Account routes
 * All routes require authentication
 */
router.get(
  "/",
  requireSession,
  validateQuery(getAccountsQuerySchema),
  getAccountsController
);

export default router;
