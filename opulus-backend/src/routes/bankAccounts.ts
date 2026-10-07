import {
  getBankAccountsController,
  getBankAccountsQuerySchema,
} from "@/controllers/bankAccounts/getBankAccountsController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { validateQuery } from "@/middleware/validation.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * Bank account routes
 * All routes require authentication
 */
router.get(
  "/",
  requireSession,
  validateQuery(getBankAccountsQuerySchema),
  getBankAccountsController
);

export default router;
