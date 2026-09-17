import { disconnectDb } from "./helpers/db.js";

/**
 * Disconnect the seeding-only test-DB client (if any spec opened one) so the
 * Prisma connection does not keep the Playwright process alive after the run.
 */
export default async function globalTeardown(): Promise<void> {
  await disconnectDb();
}
