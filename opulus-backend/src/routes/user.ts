import { exportUserDataController } from "@/controllers/user/exportUserDataController.js";
import { exportRateLimit } from "@/middleware/rateLimit.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * User routes
 * All routes require authentication
 */
router.get(
  "/export",
  requireSession,
  exportRateLimit,
  exportUserDataController
);

export default router;
