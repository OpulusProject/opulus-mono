import { Router } from "express";
import { sessionController } from "@/controllers/session/sessionController.js";
import plaidRouter from "./plaid.js";
import itemsRouter from "./items.js";
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

// Plaid routes
router.use("/plaid", plaidRouter);

// Items routes
router.use("/items", itemsRouter);

// Transactions routes
router.use("/transactions", transactionsRouter);

// Note: Better Auth routes are handled by Better Auth handler in server.ts at /api/auth
// All /api/auth/* routes are handled by Better Auth (sign-in, sign-up, sign-out, TOTP, etc.)

// Route placeholders (to be implemented)
// router.use("/users", userRouter);
// router.use("/accounts", accountRouter);

export default router;
