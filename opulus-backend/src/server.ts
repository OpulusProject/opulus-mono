// Load .env FIRST, before any other imports that depend on environment variables
import "dotenv/config";

import { auth } from "@/client/auth.js";
import { errorHandler } from "@/middleware/errorHandler.js";
import router from "@/routes/index.js";
import { config, prisma } from "@opulus/core";
import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { json, urlencoded } from "express";

const app = express();

// Trust proxy (Railway uses a reverse proxy)
// This ensures Express correctly detects HTTPS and sets secure cookies
app.set("trust proxy", 1);

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

// Debug middleware to log cookie headers (temporary, for debugging)
app.use((req, res, next) => {
  if (req.path.startsWith("/api/auth")) {
    console.log("[AUTH DEBUG] Request:", {
      path: req.path,
      method: req.method,
      origin: req.headers.origin,
      cookie: req.headers.cookie || "none",
      "x-forwarded-proto": req.headers["x-forwarded-proto"],
      secure: req.secure,
    });

    // Log Set-Cookie headers in response
    const originalSetHeader = res.setHeader.bind(res);
    res.setHeader = function (name: string, value: string | string[]) {
      if (name.toLowerCase() === "set-cookie") {
        console.log("[AUTH DEBUG] Setting cookie:", value);
      }
      return originalSetHeader(name, value);
    };
  }
  next();
});

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
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🔗 API available at ${baseURL}/api`);
});
