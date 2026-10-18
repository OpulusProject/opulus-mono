import { expect, type APIResponse } from "@playwright/test";

/**
 * The one assertion that is the receiver's own, so it lives beside the webhooks
 * suite instead of in opulus-tests/shared/: the receiver's error envelope is
 * `{ message: string }`, intentionally different from the backend's
 * `{ error, message, code }`. Status and 2xx checks are the shared ones
 * (shared/assertions.ts).
 */

/**
 * The verification middleware rejects with a plain `{ message: string }`
 * envelope. Assert the message conveys the expected reason (substring match
 * keeps it resilient to wording tweaks).
 */
export async function expectMessageIncludes(
  res: APIResponse,
  fragment: string,
): Promise<unknown> {
  const body = await res.json();
  expect(typeof body.message).toBe("string");
  expect(body.message).toContain(fragment);
  return body;
}
