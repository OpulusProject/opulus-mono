/**
 * Custom error classes for better error handling
 */

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string = "Validation failed",
    public details?: Array<{ field: string; message: string }>
  ) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists", code?: string) {
    super(message, 409, code || "CONFLICT");
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class TwoFactorRequiredError extends AppError {
  constructor(
    message: string = "Two-factor authentication must be set up before using the app"
  ) {
    super(message, 403, "TWO_FACTOR_REQUIRED");
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    message: string = "Too many requests, try again later",
    /** Seconds until the caller may try again. */
    public retryAfterSeconds?: number
  ) {
    super(message, 429, "RATE_LIMITED");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}
