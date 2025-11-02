import { Router } from "express";
import authRouter from "./auth.js";

const router = Router();

// Health check endpoint
router.get("/healthcheck", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes (Better Auth)
router.use("/auth", authRouter);

// Route placeholders (to be implemented)
// router.use("/users", userRouter);
// router.use("/plaid", plaidRouter);
// router.use("/items", itemRouter);
// router.use("/accounts", accountRouter);
// router.use("/transactions", transactionRouter);

export default router;

