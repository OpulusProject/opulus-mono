import { Router } from "express";
import { createLinkTokenController } from "@/controllers/plaid/createLinkTokenController.js";
import { getInstitutionsController } from "@/controllers/plaid/getInstitutionsController.js";
import { refreshTransactionsController } from "@/controllers/plaid/refreshTransactionsController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { validate } from "@/middleware/validation.js";
import { refreshTransactionsBodySchema } from "@/controllers/plaid/refreshTransactionsController.js";

const router: ReturnType<typeof Router> = Router();

/**
 * Plaid routes
 * All routes require authentication
 */
router.post("/link-token", requireSession, createLinkTokenController);

router.get("/institutions", requireSession, getInstitutionsController);

router.post(
  "/transactions/refresh",
  requireSession,
  validate(refreshTransactionsBodySchema),
  refreshTransactionsController
);

export default router;
