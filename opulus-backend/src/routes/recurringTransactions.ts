import {
  getRecurringController,
  getRecurringQuerySchema,
} from "@/controllers/recurring/getRecurringController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { validateQuery } from "@/middleware/validation.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * Recurring transactions routes
 * All routes require authentication
 */
router.get(
  "/",
  requireSession,
  validateQuery(getRecurringQuerySchema),
  getRecurringController
);

export default router;
