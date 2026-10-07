import { disconnectDb } from "../../shared/db.js";

/** Disconnect the test-DB client so Prisma doesn't keep the process alive. */
export default async function globalTeardown(): Promise<void> {
  await disconnectDb();
}
