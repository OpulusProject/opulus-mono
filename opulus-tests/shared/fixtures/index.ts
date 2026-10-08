/**
 * Fixture barrel for helpers shared across the service and integration suites.
 * Each fixture lives in its own resource-scoped file; specs import from
 * "../shared/fixtures/index.js" (service suite) or
 * "../../shared/fixtures/index.js" (integration suite) and stay decoupled from
 * the layout.
 *
 * Plaid Sandbox helpers live in opulus-tests/integration/helpers/ and
 * are intentionally NOT exported here — they are only consumed by the
 * integration suite, which gates on sandbox credentials.
 */
export * from "./auth.js";
export * from "./two-factor.js";
export * from "./items.js";
export * from "./liabilities.js";
export * from "./transactions.js";
