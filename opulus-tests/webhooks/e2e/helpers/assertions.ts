import { expect, type APIResponse } from "@playwright/test";

/**
 * Standardized response assertions for the webhooks receiver.
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
 * The receiver's verification middleware rejects with a plain
 * `{ message: string }` envelope. Assert the message conveys the expected
 * failure reason (substring match keeps the assertion resilient to wording).
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
