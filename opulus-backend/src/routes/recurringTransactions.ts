import {
  syncRecurringBodySchema,
  syncRecurringController,
} from "@/controllers/recurring/syncRecurringController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { validate } from "@/middleware/validation.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * Recurring transactions routes
 * All routes require authentication
 */
router.post(
  "/sync",
  requireSession,
  validate(syncRecurringBodySchema),
  syncRecurringController
);

export default router;
