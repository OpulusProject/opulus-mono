import "dotenv/config";
import express, { Router, json, urlencoded } from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { verifyPlaidWebhook } from "./middleware/verifyPlaidWebhook.js";
import { handlePlaidWebhook } from "./plaid/handlePlaidWebhook.js";

const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 8081;

const app = express();

// Body parser middleware for non-webhook routes
app.use(json());
app.use(urlencoded({ extended: true }));

const router = Router();

// Plaid Webhook route
// Use raw body parser for webhook verification
// The verification middleware needs the raw body string for hash comparison
router.post("/webhook/plaid", verifyPlaidWebhook, handlePlaidWebhook);

app.use(router);

// Global error handler
app.use(errorHandler);

app.listen(WEBHOOK_PORT, () => {
  console.log(
    `Webhook receiver is up and running at http://localhost:${WEBHOOK_PORT}`
  );
});
