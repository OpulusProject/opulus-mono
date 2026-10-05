import { getInstitutionsController } from "@/controllers/institutions/getInstitutionsController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * Institutions routes
 * All routes require authentication
 */
router.get("/", requireSession, getInstitutionsController);

export default router;
