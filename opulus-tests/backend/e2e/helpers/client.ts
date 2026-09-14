import { randomBytes } from "node:crypto";
import { type APIResponse } from "@playwright/test";

/**
 * Base URL of the service under test. Everything behind it is a black box.
 */
export const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:8080";

/**
 * Collision-proof suffix so each test can create its own data without relying
 * on a shared database reset. Prefer namespacing over truncation: the DB is a
 * black box, so tests must not assume they can wipe it.
 *
 *   uniqueId("user") // -> "user_9f3a1c7b2d40"
 */
export function uniqueId(prefix = "t"): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

/**
 * A unique, syntactically-valid email for a throwaway account.
 *
 *   uniqueEmail() // -> "user_9f3a1c7b2d40@regression.test"
 */
export function uniqueEmail(prefix = "user"): string {
  return `${uniqueId(prefix)}@regression.test`;
}

/**
 * better-auth issues the session as an httpOnly cookie with `secure: true` and
 * a cross-subdomain `Domain` attribute (see opulus-backend/src/client/auth.ts).
 * A normal cookie jar refuses to replay such a cookie over http://localhost, so
 * we stay black-box by pulling the raw Set-Cookie value off the response and
 * replaying it verbatim as a Cookie request header.
 *
 * Returns the `name=value` pair for the session cookie (attributes stripped).
 */
export function extractSessionCookie(res: APIResponse): string {
  const setCookies = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value);

  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    if (pair.includes("session_token")) {
      return pair.trim();
    }
  }

  throw new Error(
    `No session cookie found in Set-Cookie headers: ${JSON.stringify(setCookies)}`,
  );
}

/** Convenience header object for authenticating a request with a session cookie. */
export function withSession(cookie: string): { cookie: string } {
  return { cookie };
}
