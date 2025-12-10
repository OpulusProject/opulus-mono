import "dotenv/config";
import express, { Router, json, urlencoded } from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { validateWebhook } from "./middleware/validateWebhook.js";
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
router.post(
  "/webhook/plaid",
  express.raw({ type: "application/json" }),
  async (req, res, next) => {
    try {
      // Store raw body string for signature verification
      const rawBodyString = req.body.toString();
      // Attach raw body to request for verification middleware
      (req as any).rawBody = rawBodyString;
      // Parse JSON body for handlers
      req.body = JSON.parse(rawBodyString);
      next();
    } catch (error) {
      next(error);
    }
  },
  verifyPlaidWebhook,
  validateWebhook,
  handlePlaidWebhook,
);

app.use(router);

// Global error handler
app.use(errorHandler);

app.listen(WEBHOOK_PORT, () => {
  console.log(
    `Webhook receiver is up and running at http://localhost:${WEBHOOK_PORT}`,
  );
});
