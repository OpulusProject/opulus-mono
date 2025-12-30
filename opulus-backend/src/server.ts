// Load .env FIRST, before any other imports that depend on environment variables
import "dotenv/config";

import { auth } from "@/client/auth.js";
import { errorHandler } from "@/middleware/errorHandler.js";
import router from "@/routes/index.js";
import { config } from "@opulus/core";
import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { json, urlencoded } from "express";

const app = express();

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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🔗 API available at http://localhost:${PORT}/api`);
});
