import { exportUserDataController } from "@/controllers/user/exportUserDataController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * User routes
 * All routes require authentication
 */
router.get("/export", requireSession, exportUserDataController);

export default router;
