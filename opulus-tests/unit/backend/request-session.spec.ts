import { UnauthorizedError } from "@opulus/core";
import { expect, test } from "@playwright/test";
import { getRequestSession } from "../../../opulus-backend/src/middleware/session/requestSession.js";

type Response = Parameters<typeof getRequestSession>[0];
const responseWith = (locals: Record<string, unknown>) => ({ locals }) as unknown as Response;

/**
 * Reading the session a request was authenticated with
 * (opulus-backend/src/middleware/session/requestSession.ts). The guard in front
 * of every /api route stores it; a route that somehow runs without one must
 * answer 401, not run as nobody.
 *
 * Test cases:
 * - gives the session the guard stored
 * - refuses with a 401 when there is no session, or one without a user
 */
test.describe("request session", () => {
  test("gives the session the guard stored", () => {
    const session = { user: { id: "user-1" }, session: { id: "s1" } };

    expect(getRequestSession(responseWith({ session }))).toBe(session);
  });

  test("refuses with a 401 when there is no session, or one without a user", () => {
    for (const locals of [{}, { session: null }, { session: {} }]) {
      expect(() => getRequestSession(responseWith(locals))).toThrow(UnauthorizedError);
    }
    expect(() => getRequestSession(responseWith({}))).toThrow("Authentication required");
  });
});
