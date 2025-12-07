import { Router } from "express";
import { sessionController } from "@/controllers/session/sessionController.js";
import plaidRouter from "./plaid.js";

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

// Note: Better Auth routes are handled by Better Auth handler in server.ts at /api/auth
// All /api/auth/* routes are handled by Better Auth (sign-in, sign-up, sign-out, TOTP, etc.)

// Route placeholders (to be implemented)
// router.use("/users", userRouter);
// router.use("/items", itemRouter);
// router.use("/accounts", accountRouter);
// router.use("/transactions", transactionRouter);

export default router;


