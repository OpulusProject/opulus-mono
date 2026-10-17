import { Router } from "express";
import { sessionController } from "@/controllers/session/sessionController.js";
import { requireSessionWithoutTwoFactor } from "@/middleware/session/requireSession.js";
import accountsRouter from "./accounts.js";
import institutionsRouter from "./institutions.js";
import investmentsRouter from "./investments.js";
import itemsRouter from "./items.js";
import linkTokensRouter from "./linkTokens.js";
import transactionsRouter from "./transactions.js";
import userRouter from "./user.js";

const router: ReturnType<typeof Router> = Router();

// Health check endpoint
router.get("/healthcheck", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

router.get("/session", requireSessionWithoutTwoFactor, sessionController);

// Account routes
router.use("/accounts", accountsRouter);

// Institutions routes
router.use("/institutions", institutionsRouter);

// Investments routes
router.use("/investments", investmentsRouter);

// Items routes
router.use("/items", itemsRouter);

// Link token routes
router.use("/link-tokens", linkTokensRouter);

// Transactions routes
router.use("/transactions", transactionsRouter);

// User routes (data export)
router.use("/user", userRouter);

// Note: Better Auth routes are handled by Better Auth handler in server.ts at /api/auth
// All /api/auth/* routes are handled by Better Auth (sign-in, sign-up, sign-out, TOTP, etc.)

// Route placeholders (to be implemented)
// router.use("/users", userRouter);
// router.use("/accounts", accountRouter);

export default router;
