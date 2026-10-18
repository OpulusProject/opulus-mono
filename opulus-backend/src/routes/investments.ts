import {
  getActivityController,
  getActivityQuerySchema,
} from "@/controllers/investments/getActivityController.js";
import {
  getActivitySummaryController,
  getActivitySummaryQuerySchema,
} from "@/controllers/investments/getActivitySummaryController.js";
import {
  getHoldingsController,
  getHoldingsQuerySchema,
} from "@/controllers/investments/getHoldingsController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { validateQuery } from "@/middleware/validation.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * Investments routes
 * All routes require authentication
 */
router.get(
  "/holdings",
  requireSession,
  validateQuery(getHoldingsQuerySchema),
  getHoldingsController
);

router.get(
  "/activity",
  requireSession,
  validateQuery(getActivityQuerySchema),
  getActivityController
);

router.get(
  "/activity/summary",
  requireSession,
  validateQuery(getActivitySummaryQuerySchema),
  getActivitySummaryController
);

export default router;
