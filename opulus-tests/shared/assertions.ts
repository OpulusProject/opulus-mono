import { expect, type APIResponse } from "@playwright/test";
import type { ZodType } from "zod";

/**
 * Standardized response assertions. Import these in every spec so success and
 * failure are checked the same way across the whole suite.
 */

/** Assert a 2xx response, with a failure that dumps status + body for triage. */
export async function expectOk(res: APIResponse): Promise<void> {
  if (!res.ok()) {
    throw new Error(
      `Expected 2xx but got ${res.status()} from ${res.url()}: ${await res.text()}`,
    );
  }
}

/** Assert an exact status code, with the same triage-friendly failure. */
export async function expectStatus(
  res: APIResponse,
  status: number,
): Promise<void> {
  if (res.status() !== status) {
    throw new Error(
      `Expected ${status} but got ${res.status()} from ${res.url()}: ${await res.text()}`,
    );
  }
}

/**
 * Assert the service's error envelope carries a specific machine-readable code.
 *
 * ENVELOPE (service-specific): @opulus/core's AppError hierarchy serializes as
 * `{ error, message, code }`, so the code lives at `body.code` (not
 * `body.error.code`).
 */
export async function expectErrorCode(
  res: APIResponse,
  code: string,
): Promise<unknown> {
  const body = await res.json();
  expect(body.code).toBe(code);
  return body;
}

/**
 * Assert a validation failure. The backend's ValidationError serializes as
 * `{ error: "Validation failed", details: [{ field, message }] }` with a 400.
 */
export async function expectValidationError(res: APIResponse): Promise<unknown> {
  await expectStatus(res, 400);
  const body = await res.json();
  expect(body.error).toBe("Validation failed");
  expect(Array.isArray(body.details)).toBe(true);
  return body;
}

/**
 * Assert a response body is exactly what a DTO schema describes: every field
 * has the documented type and nothing else is exposed. The schema comes from
 * @opulus/core, the same one the DTO types are derived from, so the contract
 * has one definition.
 *
 * Zod drops fields it does not know when parsing, so the parsed body being
 * equal to the raw body is what proves nothing extra was sent.
 */
export async function expectMatchesSchema<T>(
  res: APIResponse,
  schema: ZodType<T>,
): Promise<T> {
  const body: unknown = await res.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `Response from ${res.url()} does not match its schema: ${JSON.stringify(parsed.error.issues)}`,
    );
  }
  expect(parsed.data, "fields outside the schema were returned").toEqual(body);
  return parsed.data;
}
