import {
  getAccountsController,
  getAccountsQuerySchema,
} from "@/controllers/accounts/getAccountsController.js";
import {
  getAccountsSummaryController,
  getAccountsSummaryQuerySchema,
} from "@/controllers/accounts/getAccountsSummaryController.js";
import {
  getNetWorthHistoryController,
  getNetWorthHistoryQuerySchema,
} from "@/controllers/accounts/getNetWorthHistoryController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { validateQuery } from "@/middleware/validation.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * Account routes
 * All routes require authentication
 */
router.get(
  "/",
  requireSession,
  validateQuery(getAccountsQuerySchema),
  getAccountsController
);

router.get(
  "/summary",
  requireSession,
  validateQuery(getAccountsSummaryQuerySchema),
  getAccountsSummaryController
);

router.get(
  "/net-worth",
  requireSession,
  validateQuery(getNetWorthHistoryQuerySchema),
  getNetWorthHistoryController
);

export default router;
