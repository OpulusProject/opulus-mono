import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

/**
 * Request ID middleware
 * Generates a unique request ID for each request and attaches it to req object
 * This allows correlating logs across the request lifecycle
 * Must be mounted before requestLogger middleware
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate or use existing request ID (from header if present)
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();

  // Attach to request object for use in handlers
  (req as Request & { id: string }).id = requestId;

  // Add to response headers for client correlation
  res.setHeader("X-Request-ID", requestId);

  next();
}

