import { PlaidError } from "plaid";
import { AppError } from "./errors.js";

/**
 * Handle Plaid API errors and convert them to application errors
 * @param error - Error from Plaid API
 * @returns AppError instance with appropriate status code and message
 */
export function handlePlaidError(error: unknown): AppError {
  if (error && typeof error === "object" && "error_code" in error) {
    const plaidError = error as PlaidError;

    // Map Plaid error codes to HTTP status codes
    const statusCodeMap: Record<string, number> = {
      INVALID_ACCESS_TOKEN: 401,
      ITEM_LOGIN_REQUIRED: 401,
      INVALID_API_KEYS: 401,
      INVALID_CLIENT_ID: 401,
      INVALID_SECRET: 401,
      UNAUTHORIZED: 401,
      INVALID_REQUEST: 400,
      INVALID_INPUT: 400,
      INVALID_ACCOUNT_ID: 400,
      INVALID_ITEM: 400,
      RATE_LIMIT_EXCEEDED: 429,
      API_ERROR: 500,
      INTERNAL_SERVER_ERROR: 500,
    };

    const statusCode = statusCodeMap[plaidError.error_code] || 500;
    const message = plaidError.error_message || "Plaid API error occurred";

    return new AppError(message, statusCode, plaidError.error_code);
  }

  // If it's not a Plaid error, wrap it as a generic error
  if (error instanceof Error) {
    return new AppError(error.message, 500, "PLAID_ERROR");
  }

  return new AppError(
    "An unexpected error occurred with Plaid",
    500,
    "PLAID_ERROR"
  );
}
