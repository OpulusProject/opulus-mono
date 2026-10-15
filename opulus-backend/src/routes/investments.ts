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

export default router;
