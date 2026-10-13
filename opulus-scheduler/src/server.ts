// Load .env FIRST, before any other imports that depend on environment variables
import "dotenv/config";

import {
  checkRedisConnection,
  errorHandler,
  logger,
  prisma,
  requestIdMiddleware,
  requestLogger,
} from "@opulus/core";
import express from "express";
import {
  createSchedulerWorker,
  registerSchedules,
  runJobsOnStart,
  shutdownScheduler,
} from "./queue/schedulerQueue.js";
import { jobsRouter } from "./routes/jobs.js";

const SCHEDULER_PORT = parseInt(process.env.SCHEDULER_PORT || "8082", 10);

const worker = createSchedulerWorker();
await registerSchedules();
// On by default so a fresh deploy fills the tables without waiting for the
// schedule; SCHEDULER_RUN_ON_START=false turns it off (the jobs suite does, so
// a start-up run does not race its own runs).
if (process.env.SCHEDULER_RUN_ON_START !== "false") {
  await runJobsOnStart();
}

const app = express();
app.use(requestIdMiddleware);
app.use(requestLogger);

// /health - the process is up (no dependencies checked)
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "scheduler",
  });
});

// /ready - the database and Redis answer and the worker is running
app.get("/ready", async (_req, res) => {
  const database = await prisma.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  );
  const redis = await checkRedisConnection();
  const running = worker.isRunning();
  res.status(database && redis && running ? 200 : 503).json({
    status: database && redis && running ? "ready" : "not ready",
    timestamp: new Date().toISOString(),
    database: database ? "connected" : "disconnected",
    redis: redis ? "connected" : "disconnected",
    worker: running ? "running" : "stopped",
  });
});

const adminToken = process.env.SCHEDULER_ADMIN_TOKEN;
if (adminToken) {
  app.use("/jobs", jobsRouter(adminToken));
} else {
  logger.info("SCHEDULER_ADMIN_TOKEN is not set, so the jobs API is off");
}

app.use(errorHandler);

// "::" accepts IPv4 and IPv6, so Railway's private network reaches it either
// way (older environments route private traffic over IPv6 only).
const server = app.listen(SCHEDULER_PORT, "::", () => {
  logger.info(`Scheduler is up on port ${SCHEDULER_PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully...`);
  await shutdownScheduler(worker);
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
