import { Router } from "express";
import { createLinkTokenController } from "@/controllers/plaid/createLinkTokenController.js";
import { requireSession } from "@/middleware/session/requireSession.js";

const router: ReturnType<typeof Router> = Router();

/**
 * Plaid routes
 * All routes require authentication
 */
router.post("/link-token", requireSession, createLinkTokenController);

export default router;
