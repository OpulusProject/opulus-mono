import { Router } from "express";

const router = Router();

// Health check endpoint
router.get("/healthcheck", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Note: Better Auth routes are mounted directly in server.ts at /api/auth
// This keeps Better Auth separate from other API routes

// Route placeholders (to be implemented)
// router.use("/users", userRouter);
// router.use("/plaid", plaidRouter);
// router.use("/items", itemRouter);
// router.use("/accounts", accountRouter);
// router.use("/transactions", transactionRouter);

export default router;

