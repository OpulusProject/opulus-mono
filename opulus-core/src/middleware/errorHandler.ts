import { NextFunction, Request, Response } from "express";
import {
  AppError,
  ConflictError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/** The status and message for an error from Express's body parsers, or null for any other error. */
function bodyParserFailure(
  error: unknown
): { status: number; message: string } | null {
  const { type, status } = (error ?? {}) as {
    type?: unknown;
    status?: unknown;
  };
  if (typeof type !== "string" || !type.startsWith("entity.")) return null;
  if (typeof status !== "number" || status < 400 || status > 499) return null;
  return {
    status,
    message:
      type === "entity.too.large"
        ? "Request body too large"
        : "Malformed request body",
  };
}

/**
 * Global error handler middleware, shared by the backend and the webhooks
 * receiver so both answer errors the same way. Handles all errors and sends
 * appropriate HTTP responses; mount it after every route.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as Request & { id?: string }).id || "unknown";

  logger.error(
    {
      type: "http_error",
      request_id: requestId,
      method: req.method,
      path: req.path,
      status_code: error instanceof AppError ? error.statusCode : 500,
      error_type:
        error instanceof Error ? error.constructor.name : typeof error,
      error_message: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
      error_code:
        error instanceof AppError || error instanceof ConflictError
          ? error.code
          : undefined,
    },
    "Request error"
  );
  // A body the parser could not read or would not accept (malformed JSON, too
  // large) is the caller's mistake, not ours: answer it, without the parser's
  // message or stack.
  const parseFailure = bodyParserFailure(error);
  if (parseFailure) {
    res.status(parseFailure.status).json({
      error: "Bad request",
      message: parseFailure.message,
    });
    return;
  }

  // Handle known error types
  if (error instanceof ValidationError) {
    res.status(error.statusCode).json({
      error: "Validation failed",
      details: error.details,
    });
    return;
  }

  if (error instanceof ConflictError) {
    res.status(error.statusCode).json({
      error: "Conflict",
      message: error.message,
      code: error.code,
    });
    return;
  }

  if (error instanceof NotFoundError) {
    res.status(error.statusCode).json({
      error: "Not found",
      message: error.message,
    });
    return;
  }

  if (error instanceof TooManyRequestsError) {
    res.status(error.statusCode).json({
      error: "Too many requests",
      message: error.message,
      code: error.code,
    });
    return;
  }

  if (error instanceof UnauthorizedError) {
    res.status(error.statusCode).json({
      error: "Unauthorized",
      message: error.message,
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: "Application error",
      message: error.message,
      code: error.code,
    });
    return;
  }

  // Handle generic errors
  if (error instanceof Error) {
    res.status(500).json({
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : "An unexpected error occurred",
    });
    return;
  }

  // Fallback for unknown errors
  res.status(500).json({
    error: "Internal server error",
    message: "An unexpected error occurred",
  });
}
