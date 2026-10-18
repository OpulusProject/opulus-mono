// Load .env FIRST, before any other imports that depend on environment variables
import "dotenv/config";
import "./checkConfig.js";

import { auth } from "@/auth.js";
import { apiRateLimit } from "@/middleware/rateLimit.js";
import { requireApiSession } from "@/middleware/session/requireApiSession.js";
import router from "@/routes/index.js";
import {
  config,
  errorHandler,
  NotFoundError,
  logger,
  prisma,
  requestIdMiddleware,
  requestLogger,
} from "@opulus/core";
import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { json, urlencoded } from "express";

const app = express();

// Do not announce the framework in every response.
app.disable("x-powered-by");

// Trust proxy (Railway uses a reverse proxy)
// This ensures Express correctly detects HTTPS and sets secure cookies
app.set("trust proxy", 1);

// Request ID middleware (must be first - before requestLogger)
app.use(requestIdMiddleware);

// Request logging middleware (logs all HTTP requests)
app.use(requestLogger);

// Health check endpoints (before other middleware for faster response)
// /health - Simple health check (no database connection)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "backend",
  });
});

// /ready - Readiness check (includes database connection)
app.get("/ready", async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ready",
      timestamp: new Date().toISOString(),
      database: "connected",
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

// CORS Configuration
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Better Auth counts its rate limits per client address, and reads that from the
// X-Forwarded-For header, whose first entry the caller can write. Express works
// out the real address from the proxy's own entry (`trust proxy`), so hand that
// one to Better Auth instead.
app.use("/api/auth", (req, _res, next) => {
  if (req.ip) req.headers["x-forwarded-for"] = req.ip;
  next();
});

// Rate limit everything under /api (Better Auth counts its own routes too)
app.use("/api", apiRateLimit);

// Better Auth handler (mounted BEFORE body parsers)
// Better Auth docs: express.json() should be used AFTER mounting Better Auth handler
// Mounting it before prevents the client API from getting stuck on "pending"
// Using Express v5 wildcard syntax: /{*any} catches all routes under /api/auth
// Better Auth handles all authentication routes: sign-in, sign-up, sign-out, TOTP, etc.
app.all("/api/auth/{*any}", toNodeHandler(auth));

// Body Parser Middleware (must come AFTER Better Auth handler)
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());

// API Routes: nothing under /api is open unless requireApiSession lists it
app.use("/api", requireApiSession);
app.use("/api", router);

// Anything under /api that no route answered is a JSON 404, not Express's HTML page.
app.use("/api", (_req, _res, next) =>
  next(new NotFoundError("Route not found"))
);

// Global error handler (must be last middleware)
app.use(errorHandler);

const PORT = config.port;
const baseURL = config.betterAuthBaseURL || `http://localhost:${PORT}`;

const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`API available at ${baseURL}/api`);
});

/** How long in-flight requests get to finish before the process gives up. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

let shuttingDown = false;

/**
 * Stop cleanly when the platform asks (a deploy sends SIGTERM): stop accepting
 * connections, let requests that are already running finish, close the database
 * connection, then exit. Without this a deploy cuts off whatever was in
 * flight. If it has not finished in SHUTDOWN_TIMEOUT_MS the process exits
 * anyway, with a failure status.
 */
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down gracefully");

  const giveUp = setTimeout(() => {
    logger.error("Shutdown did not finish in time; exiting");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  giveUp.unref();

  server.close(async (error) => {
    if (error)
      logger.error(
        { error_message: error.message },
        "Error closing the server"
      );
    await prisma.$disconnect();
    logger.info("Shut down gracefully");
    process.exit(error ? 1 : 0);
  });
  // Keep-alive connections with no request running would hold the server open.
  server.closeIdleConnections();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
