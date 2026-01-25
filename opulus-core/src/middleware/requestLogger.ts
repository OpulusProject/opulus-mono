import { logger } from "../utils/logger.js";
import { NextFunction, Request, Response } from "express";

/**
 * Request logging middleware
 * Automatically logs all HTTP requests with entry and exit points
 * Logs request received and request completed with duration
 * Must be mounted after requestIdMiddleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const requestId = (req as Request & { id?: string }).id || "unknown";

  // Log request received
  logger.info(
    {
      type: "http_request",
      method: req.method,
      path: req.path,
      request_id: requestId,
      user_agent: req.get("user-agent"),
      ip: req.ip,
    },
    "Request received"
  );

  // Log request completed when response finishes
  res.on("finish", () => {
    const durationMs = Date.now() - startTime;

    logger.info(
      {
        type: "http_request",
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        duration_ms: durationMs,
        request_id: requestId,
      },
      "Request completed"
    );
  });

  next();
}

