import {
  getSpendingByCategoryController,
  getSpendingByCategoryQuerySchema,
} from "@/controllers/transactions/getSpendingByCategoryController.js";
import {
  getTransactionsController,
  getTransactionsQuerySchema,
} from "@/controllers/transactions/getTransactionsController.js";
import {
  getDailyTransactionTotalsController,
  getDailyTransactionTotalsQuerySchema,
} from "@/controllers/transactions/getDailyTransactionTotalsController.js";
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
  "/daily-totals",
  requireSession,
  validateQuery(getDailyTransactionTotalsQuerySchema),
  getDailyTransactionTotalsController
);

router.get(
  "/spending-by-category",
  requireSession,
  validateQuery(getSpendingByCategoryQuerySchema),
  getSpendingByCategoryController
);

router.post(
  "/refresh",
  requireSession,
  validate(refreshTransactionsBodySchema),
  refreshTransactionsController
);

export default router;
