import { testDb } from "../db.js";

/**
 * Link event fixtures.
 *
 * Link events have no read endpoint (they are kept for tracing a failed
 * connection, not shown to the user), so what the endpoint stored is read from
 * the ISOLATED test DB: the exception to "verify over HTTP", as for the
 * scheduler's jobs.
 */

/** A user's stored Link events, oldest first. */
export async function readLinkEvents(userId: string) {
  return testDb().linkEvent.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

/** The ids of a user's login sessions, oldest first. */
export async function readSessionIds(userId: string): Promise<string[]> {
  const sessions = await testDb().session.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return sessions.map((session) => session.id);
}
