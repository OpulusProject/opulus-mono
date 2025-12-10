import {
  AppError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Global error handler middleware
 * Handles all errors and sends appropriate HTTP responses
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
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
