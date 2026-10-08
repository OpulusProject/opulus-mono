import {
  getTransactionsController,
  getTransactionsQuerySchema,
} from "@/controllers/transactions/getTransactionsController.js";
import {
  getTransactionsSummaryController,
  getTransactionsSummaryQuerySchema,
} from "@/controllers/transactions/getTransactionsSummaryController.js";
import {
  refreshTransactionsBodySchema,
  refreshTransactionsController,
} from "@/controllers/transactions/refreshTransactionsController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { validate, validateQuery } from "@/middleware/validation.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * Transactions routes
 * All routes require authentication
 */
router.get(
  "/",
  requireSession,
  validateQuery(getTransactionsQuerySchema),
  getTransactionsController
);

router.get(
  "/summary",
  requireSession,
  validateQuery(getTransactionsSummaryQuerySchema),
  getTransactionsSummaryController
);

router.post(
  "/refresh",
  requireSession,
  validate(refreshTransactionsBodySchema),
  refreshTransactionsController
);

export default router;
