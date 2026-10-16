import { randomBytes } from "node:crypto";
import { type APIResponse } from "@playwright/test";

/**
 * Base URL of the service under test. Everything behind it is a black box.
 */
export const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:8080";

/**
 * Collision-proof suffix so each test can create its own data without relying
 * on a shared database reset. Prefer namespacing over truncation.
 *
 *   uniqueId("user") // -> "user_9f3a1c7b2d40"
 */
export function uniqueId(prefix = "t"): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

/** A unique, syntactically-valid email for a throwaway account. */
/**
 * An IP address of its own, for the X-Forwarded-For header. The auth routes
 * rate limit per client address, and every spec comes from one address, so each
 * user a spec creates gets its own to keep the limits to the test that is
 * testing them. (Addresses from 198.51.0.0/16, which the specs never use for anything else.)
 */
let nextIp = Math.floor(Math.random() * 60_000);
export function uniqueIp(): string {
  nextIp += 1;
  return `198.51.${(nextIp >> 8) % 256}.${nextIp % 256}`;
}

export function uniqueEmail(prefix = "user"): string {
  return `${uniqueId(prefix)}@regression.test`;
}

/**
 * AUTH ADAPTATION: this service authenticates with better-auth session
 * *cookies*, not bearer tokens. The cookie is issued `secure` with a
 * cross-subdomain `Domain`, so a normal cookie jar won't replay it over
 * http://localhost. We stay black-box by pulling the raw Set-Cookie value off
 * the response and replaying it verbatim as a Cookie request header.
 *
 * Returns the `name=value` session cookie pair (attributes stripped).
 */
export function extractSessionCookie(res: APIResponse): string {
  return extractCookie(res, "session_token");
}

/**
 * The `name=value` pair of the first cookie a response sets whose name contains
 * `namePart` (for example "two_factor" for the challenge cookie sign-in sets
 * when a second factor is needed), ready to replay as a Cookie header.
 */
export function extractCookie(res: APIResponse, namePart: string): string {
  const setCookies = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value);

  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    if (pair.includes(namePart)) {
      return pair.trim();
    }
  }

  throw new Error(
    `No ${namePart} cookie found in Set-Cookie headers: ${JSON.stringify(setCookies)}`,
  );
}

/** Whether a response sets a (non-empty) session cookie: a user was signed in. */
export function setsSessionCookie(res: APIResponse): boolean {
  return res
    .headersArray()
    .some(
      (h) =>
        h.name.toLowerCase() === "set-cookie" &&
        /^[^=;]*session_token[^=;]*=[^;]+/.test(h.value),
    );
}

/** Convenience header object for authenticating a request with a session cookie. */
export function withSession(cookie: string): Record<string, string> {
  // An address of its own, so the auth routes' per-address limits stay per call.
  return { cookie, "x-forwarded-for": uniqueIp() };
}

/** The `name=value` pairs of a response's Set-Cookie headers, as one Cookie header. */
export function cookiesFrom(res: APIResponse): string {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value.split(";")[0]!.trim())
    .join("; ");
}
