import { Router } from "express";
import { sessionController } from "@/controllers/session/sessionController.js";
import bankAccountsRouter from "./bankAccounts.js";
import institutionsRouter from "./institutions.js";
import itemsRouter from "./items.js";
import linkTokensRouter from "./linkTokens.js";
import transactionsRouter from "./transactions.js";

const router: ReturnType<typeof Router> = Router();

// Health check endpoint
router.get("/healthcheck", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

router.get("/session", sessionController);

// Bank account routes
router.use("/bank-accounts", bankAccountsRouter);

// Institutions routes
router.use("/institutions", institutionsRouter);

// Items routes
router.use("/items", itemsRouter);

// Link token routes
router.use("/link-tokens", linkTokensRouter);

// Transactions routes
router.use("/transactions", transactionsRouter);

// Note: Better Auth routes are handled by Better Auth handler in server.ts at /api/auth
// All /api/auth/* routes are handled by Better Auth (sign-in, sign-up, sign-out, TOTP, etc.)

// Route placeholders (to be implemented)
// router.use("/users", userRouter);
// router.use("/accounts", accountRouter);

export default router;
