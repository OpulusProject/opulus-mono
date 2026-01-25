// Load .env FIRST, before any other imports that depend on environment variables
import "dotenv/config";

import {
  logger,
  prisma,
  requestIdMiddleware,
  requestLogger,
} from "@opulus/core";
import express, { Router, raw } from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { verifyPlaidWebhook } from "./middleware/verifyPlaidWebhook.js";
import { handlePlaidWebhook } from "./plaid/handlePlaidWebhook.js";
import { handleItemWebhook } from "./plaid/handlers/item/index.js";
import { handleLinkWebhook } from "./plaid/handlers/link/index.js";
import { handleTransactionsWebhook } from "./plaid/handlers/transactions/index.js";
import {
  checkRedisConnection,
  createQueueEvents,
  createWebhookWorker,
  shutdownQueue,
} from "./queue/webhookQueue.js";

const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || "8081", 10);

const app = express();

// Request ID middleware (must be first)
app.use(requestIdMiddleware);

// Request logging middleware (logs all HTTP requests)
app.use(requestLogger);

const router = Router();

// Note: We don't use json() middleware globally because webhook route needs raw body
// Health check routes are GET requests and don't need body parsing

// Initialize webhook worker with handlers
// Worker is created with handlers directly, ensuring they're set before processing starts
const webhookWorker = createWebhookWorker({
  handleItemWebhook,
  handleLinkWebhook,
  handleTransactionsWebhook,
});

// Initialize queue events listener for monitoring
const queueEvents = createQueueEvents();

logger.info("Webhook queue worker initialized and ready to process webhooks");

// Health check endpoints
// /health - Simple health check (no database connection)
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "webhooks",
  });
});

// /ready - Readiness check (includes database connection, Redis, and queue worker)
router.get("/ready", async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis connection
    const redisConnected = await checkRedisConnection();

    // Check queue worker is running
    const workerRunning = webhookWorker.isRunning();

    if (!redisConnected || !workerRunning) {
      return res.status(503).json({
        status: "not ready",
        timestamp: new Date().toISOString(),
        database: "connected",
        redis: redisConnected ? "connected" : "disconnected",
        queueWorker: workerRunning ? "running" : "stopped",
      });
    }

    res.status(200).json({
      status: "ready",
      timestamp: new Date().toISOString(),
      database: "connected",
      redis: "connected",
      queueWorker: "running",
    });
  } catch (error) {
    res.status(503).json({
      status: "not ready",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Plaid Webhook route
// Use raw body parser for webhook verification
// The verification middleware needs the raw body string for hash comparison
router.post(
  "/webhook/plaid",
  raw({ type: "application/json" }),
  verifyPlaidWebhook,
  handlePlaidWebhook
);

app.use(router);

// Global error handler
app.use(errorHandler);

const server = app.listen(WEBHOOK_PORT, "0.0.0.0", () => {
  logger.info(
    `Webhook receiver is up and running at http://0.0.0.0:${WEBHOOK_PORT}`
  );
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully...");
  await shutdownQueue(webhookWorker, queueEvents);
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully...");
  await shutdownQueue(webhookWorker, queueEvents);
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});
