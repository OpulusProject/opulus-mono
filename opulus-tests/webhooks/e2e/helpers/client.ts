import { randomBytes } from "node:crypto";

/**
 * Base URL of the service under test. Everything behind it (the BullMQ queue,
 * Redis, Postgres, Plaid key verification) is a black box.
 */
export const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:8081";

/**
 * Collision-proof suffix so each test can namespace its own payloads without
 * relying on a shared reset.
 *
 *   uniqueId("wh") // -> "wh_9f3a1c7b2d40"
 */
export function uniqueId(prefix = "t"): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}
