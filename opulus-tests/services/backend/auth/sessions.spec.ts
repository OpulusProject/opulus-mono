import { expect, test } from "@playwright/test";
import { withSession } from "../../../shared/client.js";
import { expectOk, expectStatus } from "../../../shared/assertions.js";
import { createAuthedUser, signIn } from "../../../shared/fixtures/index.js";

/** The session token inside a session cookie (`name=<token>.<signature>`, URL-encoded). */
const tokenOf = (cookie: string) =>
  decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1)).split(".")[0];

/** Whether a session cookie is still accepted. */
const works = async (
  request: Parameters<Parameters<typeof test>[2]>[0]["request"],
  cookie: string,
) =>
  (await request.get("/api/session", { headers: withSession(cookie) })).status() ===
  200;

/**
 * This file: the routes behind "where you're signed in": list a user's
 * sessions and sign some of them out. Whether a session still works is read the
 * way the client reads it, from GET /api/session.
 */
test.describe("sessions", () => {
  test.describe("GET /api/auth/list-sessions", () => {
    test("requires authentication (401)", async ({ request }) => {
      await expectStatus(await request.get("/api/auth/list-sessions"), 401);
    });

    test("lists the user's sessions, one per device signed in", async ({
      request,
    }) => {
      // Arrange: signed up (one session) and signed in again (a second).
      const user = await createAuthedUser(request);
      await signIn(request, user.email);

      // Act
      const res = await request.get("/api/auth/list-sessions", {
        headers: withSession(user.cookie),
      });

      // Assert
      await expectOk(res);
      const sessions = (await res.json()) as Array<{ userId: string }>;
      expect(sessions).toHaveLength(2);
      expect(sessions.every((s) => s.userId === user.userId)).toBe(true);
    });

    test("never lists another user's sessions", async ({ request }) => {
      // Arrange
      const mine = await createAuthedUser(request);
      await createAuthedUser(request);

      // Act
      const res = await request.get("/api/auth/list-sessions", {
        headers: withSession(mine.cookie),
      });

      // Assert
      const sessions = (await res.json()) as Array<{ userId: string }>;
      expect(sessions.every((s) => s.userId === mine.userId)).toBe(true);
    });
  });

  test.describe("POST /api/auth/revoke-other-sessions", () => {
    test("requires authentication (401)", async ({ request }) => {
      await expectStatus(
        await request.post("/api/auth/revoke-other-sessions", { data: {} }),
        401,
      );
    });

    test("signs every other device out and keeps this one", async ({
      request,
    }) => {
      // Arrange
      const user = await createAuthedUser(request);
      const other = await signIn(request, user.email);

      // Act
      const res = await request.post("/api/auth/revoke-other-sessions", {
        headers: withSession(user.cookie),
        data: {},
      });

      // Assert
      await expectOk(res);
      expect(await works(request, user.cookie)).toBe(true);
      expect(await works(request, other.cookie)).toBe(false);
    });
  });

  test.describe("POST /api/auth/revoke-session", () => {
    test("signs out one session by its token, leaving the rest", async ({
      request,
    }) => {
      // Arrange: two devices, and the token of the second from the list.
      const user = await createAuthedUser(request);
      const other = await signIn(request, user.email);
      const sessions = (await (
        await request.get("/api/auth/list-sessions", {
          headers: withSession(user.cookie),
        })
      ).json()) as Array<{ token: string }>;
      const otherToken = sessions.find((s) => s.token === tokenOf(other.cookie))
        ?.token;
      expect(otherToken).toBeTruthy();

      // Act
      const res = await request.post("/api/auth/revoke-session", {
        headers: withSession(user.cookie),
        data: { token: otherToken },
      });

      // Assert
      await expectOk(res);
      expect(await works(request, other.cookie)).toBe(false);
      expect(await works(request, user.cookie)).toBe(true);
    });

    test("cannot sign out another user's session", async ({ request }) => {
      // Arrange
      const victim = await createAuthedUser(request);
      const attacker = await createAuthedUser(request);
      const victimSessions = (await (
        await request.get("/api/auth/list-sessions", {
          headers: withSession(victim.cookie),
        })
      ).json()) as Array<{ token: string }>;

      // Act: the attacker names the victim's session token.
      await request.post("/api/auth/revoke-session", {
        headers: withSession(attacker.cookie),
        data: { token: victimSessions[0]!.token },
      });

      // Assert
      expect(await works(request, victim.cookie)).toBe(true);
    });
  });

  test.describe("POST /api/auth/revoke-sessions", () => {
    test("signs every session out, this one included", async ({ request }) => {
      // Arrange
      const user = await createAuthedUser(request);
      const other = await signIn(request, user.email);

      // Act
      await expectOk(
        await request.post("/api/auth/revoke-sessions", {
          headers: withSession(user.cookie),
          data: {},
        }),
      );

      // Assert
      expect(await works(request, user.cookie)).toBe(false);
      expect(await works(request, other.cookie)).toBe(false);
    });
  });
});
