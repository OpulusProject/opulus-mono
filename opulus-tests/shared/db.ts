/**
 * Isolated test-database access, for SEEDING ONLY.
 *
 * The backend has no create endpoint for items/accounts/transactions — they are
 * only ever created by the webhooks service's Plaid link handler (real Plaid
 * exchange → DB write). Per the service-api-tests skill, resources with no
 * create endpoint may be seeded directly into an ISOLATED test database via this
 * helper so their read endpoints can be covered. All store access lives here;
 * specs and other fixtures never open a DB client directly. Never assert by
 * reading here — verification always happens over HTTP.
 *
 * The PrismaClient class is re-exported from @opulus/core so we bind to the
 * service's own generated client (matching production's schema/shape) instead of
 * depending on @prisma/client's generated output location directly.
 */
import { PrismaClient } from "@opulus/core";

let client: PrismaClient | undefined;

/**
 * Lazily-created singleton bound to the ISOLATED test database. Refuses to run
 * without an explicit TEST_DATABASE_URL so it can never touch dev or prod.
 */
export function testDb(): PrismaClient {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set — refusing to open a store connection.",
    );
  }
  client ??= new PrismaClient({ datasources: { db: { url } } });
  return client;
}

/** Called from the Playwright globalTeardown so the client does not hang the process. */
export async function disconnectDb(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
