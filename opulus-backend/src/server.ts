import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express, { json, urlencoded } from "express";
import config from "@/config/default.js";
import router from "@/routes/index.js";
import { auth } from "@/lib/auth.js";
import { toNodeHandler } from "better-auth/node";

const app = express();

// CORS Configuration
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Body Parser Middleware
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());

// Better Auth Handler - must be mounted before other routes
// Convert Better Auth handler to Express-compatible middleware
const authHandler = toNodeHandler(auth);
app.use("/api/auth", (req, res) => {
  authHandler(req, res).catch((err: Error) => {
    console.error("Better Auth handler error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// API Routes
app.use("/api", router);

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🔗 API available at http://localhost:${PORT}/api`);
});

