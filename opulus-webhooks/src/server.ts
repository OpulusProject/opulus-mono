import "dotenv/config";
import express, { Router, json, urlencoded } from "express";
import { handleWebhook } from "./handlers/handleWebhook.js";
import { verifyWebhook } from "./middleware/verifyWebhook.js";
import { errorHandler } from "./middleware/errorHandler.js";

const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 8081;

const app = express();

// Body parser middleware
app.use(json());
app.use(urlencoded({ extended: true }));

const router = Router();

// Webhook route with verification middleware
router.post("/webhook", verifyWebhook, handleWebhook);

app.use(router);

// Global error handler
app.use(errorHandler);

app.listen(WEBHOOK_PORT, () => {
  console.log(
    `Webhook receiver is up and running at http://localhost:${WEBHOOK_PORT}`,
  );
});


