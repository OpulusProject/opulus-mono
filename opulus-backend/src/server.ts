import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express, { json, urlencoded } from "express";
import config from "@/config/default.js";
import router from "@/routes/index.js";
import { errorHandler } from "@/middleware/errorHandler.js";

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

// API Routes (includes /api/auth via routes/index.ts)
app.use("/api", router);

// Global error handler (must be last middleware)
app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🔗 API available at http://localhost:${PORT}/api`);
});

