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
  getSpendingHabitsController,
  getSpendingHabitsQuerySchema,
} from "@/controllers/transactions/getSpendingHabitsController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { validateQuery } from "@/middleware/validation.js";
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

router.get(
  "/spending-habits",
  requireSession,
  validateQuery(getSpendingHabitsQuerySchema),
  getSpendingHabitsController
);

export default router;
