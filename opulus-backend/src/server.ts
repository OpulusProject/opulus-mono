// Load .env FIRST, before any other imports that depend on environment variables
import "dotenv/config";

import { auth } from "@/client/auth.js";
import { errorHandler } from "@/middleware/errorHandler.js";
import { detectDemoMode } from "@/middleware/demo/demoMode.js";
import router from "@/routes/index.js";
import {
  config,
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

// Trust proxy (Railway uses a reverse proxy)
// This ensures Express correctly detects HTTPS and sets secure cookies
app.set("trust proxy", 1);

// Request ID middleware (must be first - before requestLogger)
app.use(requestIdMiddleware);

// Demo mode detection middleware (detects from hostname)
app.use(detectDemoMode);

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

// API Routes
app.use("/api", router);

// Global error handler (must be last middleware)
app.use(errorHandler);

const PORT = config.port;
const baseURL = config.betterAuthBaseURL || `http://localhost:${PORT}`;

app.listen(PORT, "0.0.0.0", () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`API available at ${baseURL}/api`);
});
