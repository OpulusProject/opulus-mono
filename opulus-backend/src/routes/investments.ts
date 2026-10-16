import {
  syncHoldingsBodySchema,
  syncHoldingsController,
} from "@/controllers/investments/syncHoldingsController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { validate } from "@/middleware/validation.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * Investments routes
 * All routes require authentication
 */
router.post(
  "/sync",
  requireSession,
  validate(syncHoldingsBodySchema),
  syncHoldingsController
);

export default router;
