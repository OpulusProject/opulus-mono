import { Router } from "express";
import { createItemController } from "@/controllers/plaid/createItemController.js";
import { createLinkTokenController } from "@/controllers/plaid/createLinkTokenController.js";
import { createUpdateLinkTokenController } from "@/controllers/plaid/createUpdateLinkTokenController.js";
import { getInstitutionsController } from "@/controllers/plaid/getInstitutionsController.js";
import { refreshTransactionsController } from "@/controllers/plaid/refreshTransactionsController.js";
import { updateItemAccountsController } from "@/controllers/plaid/updateItemAccountsController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { validate } from "@/middleware/validation.js";
import { refreshTransactionsBodySchema } from "@/controllers/plaid/refreshTransactionsController.js";

const router: ReturnType<typeof Router> = Router();

/**
 * Plaid routes
 * All routes require authentication
 */
router.post("/link-token", requireSession, createLinkTokenController);
router.post(
  "/link-token/update",
  requireSession,
  createUpdateLinkTokenController
);

// Item creation is driven by the frontend's Link onSuccess callback (not a
// Plaid webhook) now that we no longer use Multi-Item Link.
router.post("/items", requireSession, createItemController);
router.post(
  "/items/:id/update-accounts",
  requireSession,
  updateItemAccountsController
);

router.get("/institutions", requireSession, getInstitutionsController);

router.post(
  "/transactions/refresh",
  requireSession,
  validate(refreshTransactionsBodySchema),
  refreshTransactionsController
);

export default router;
