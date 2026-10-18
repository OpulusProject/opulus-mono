import { expect, test } from "@playwright/test";
import { AppError, getPlaidErrorCode, handlePlaidError } from "@opulus/core";

/** What the Plaid SDK rejects with: an axios error whose response body is Plaid's error. */
const plaidFailure = (error_code: string, extra: Record<string, unknown> = {}) => ({
  response: {
    data: { error_type: "ITEM_ERROR", error_code, error_message: `Plaid says ${error_code}`, request_id: "req-1", ...extra },
  },
});

/**
 * Reading Plaid's errors (opulus-core/src/utils/plaidErrors.ts): what a failed
 * Plaid call becomes for the caller. The service suites see only the statuses
 * they happen to provoke; the whole mapping is pinned here.
 *
 * Test cases:
 * - getPlaidErrorCode reads the code from an SDK error, from a bare Plaid error body, and is undefined for anything else
 * - handlePlaidError maps each known Plaid code to its HTTP status
 * - handlePlaidError makes an unknown Plaid code a 500 that keeps the code and Plaid's message
 * - handlePlaidError wraps an ordinary Error as PLAID_ERROR with its message
 * - handlePlaidError wraps a thrown non-error as PLAID_ERROR with a generic message
 */
test.describe("Plaid errors", () => {
  test("getPlaidErrorCode reads the code from an SDK error, from a bare Plaid error body, and is undefined for anything else", () => {
    expect(getPlaidErrorCode(plaidFailure("ITEM_LOGIN_REQUIRED"))).toBe("ITEM_LOGIN_REQUIRED");
    expect(getPlaidErrorCode({ error_type: "API_ERROR", error_code: "INTERNAL_SERVER_ERROR" })).toBe("INTERNAL_SERVER_ERROR");
    expect(getPlaidErrorCode(new Error("socket hang up"))).toBeUndefined();
    expect(getPlaidErrorCode({ response: { data: "<html>502</html>" } })).toBeUndefined();
    expect(getPlaidErrorCode(null)).toBeUndefined();
    expect(getPlaidErrorCode(undefined)).toBeUndefined();
    expect(getPlaidErrorCode("ITEM_LOGIN_REQUIRED")).toBeUndefined();
  });

  const statuses: [string, number][] = [
    ["INVALID_ACCESS_TOKEN", 401],
    ["ITEM_LOGIN_REQUIRED", 409],
    ["INVALID_API_KEYS", 401],
    ["INVALID_CLIENT_ID", 401],
    ["INVALID_SECRET", 401],
    ["UNAUTHORIZED", 401],
    ["INVALID_REQUEST", 400],
    ["INVALID_INPUT", 400],
    ["INVALID_ACCOUNT_ID", 400],
    ["INVALID_ITEM", 400],
    ["INVALID_WEBHOOK_URL", 400],
    ["RATE_LIMIT_EXCEEDED", 429],
    ["API_ERROR", 500],
    ["INTERNAL_SERVER_ERROR", 500],
  ];
  for (const [code, status] of statuses) {
    test(`handlePlaidError maps ${code} to ${status}`, () => {
      const error = handlePlaidError(plaidFailure(code));

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ statusCode: status, code, message: `Plaid says ${code}` });
    });
  }

  test("handlePlaidError makes an unknown Plaid code a 500 that keeps the code and Plaid's message", () => {
    const error = handlePlaidError(plaidFailure("SOMETHING_PLAID_ADDED"));

    expect(error).toMatchObject({ statusCode: 500, code: "SOMETHING_PLAID_ADDED", message: "Plaid says SOMETHING_PLAID_ADDED" });
  });

  test("handlePlaidError falls back to a generic message when Plaid sent none", () => {
    const error = handlePlaidError(plaidFailure("API_ERROR", { error_message: "" }));

    expect(error.message).toBe("Plaid API error occurred");
  });

  test("handlePlaidError wraps an ordinary Error as PLAID_ERROR with its message", () => {
    const error = handlePlaidError(new Error("socket hang up"));

    expect(error).toMatchObject({ statusCode: 500, code: "PLAID_ERROR", message: "socket hang up" });
  });

  test("handlePlaidError wraps a thrown non-error as PLAID_ERROR with a generic message", () => {
    const error = handlePlaidError("boom");

    expect(error).toMatchObject({
      statusCode: 500,
      code: "PLAID_ERROR",
      message: "An unexpected error occurred with Plaid",
    });
  });
});
