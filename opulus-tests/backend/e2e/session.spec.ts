import { expect, test } from "@playwright/test";
import { withSession } from "./helpers/client.js";
import { expectOk, expectStatus } from "./helpers/assertions.js";
import { createAuthedUser } from "./helpers/fixtures.js";

/**
 * GET /api/session — the canonical "who am I" endpoint used by the frontend to
 * hydrate auth state. Exercises the requireSession-style branch: valid cookie
 * returns the user; no/invalid cookie is rejected.
 */

test.describe("GET /api/session", () => {
  test("returns the authenticated user for a valid session", async ({
    request,
  }) => {
    const { cookie, user } = await createAuthedUser(request);
    const res = await request.get("/api/session", {
      headers: withSession(cookie),
    });
    await expectOk(res);

    const body = await res.json();
    expect(body.data.user).toMatchObject({ id: user.id, email: user.email });
    expect(body.data.session.id).toBeTruthy();
  });

  test("rejects a request with no session (401)", async ({ request }) => {
    const res = await request.get("/api/session");
    await expectStatus(res, 401);
  });

  test("rejects a request with a garbage session cookie (401)", async ({
    request,
  }) => {
    const res = await request.get("/api/session", {
      headers: withSession("opulus.session_token=not-a-real-token"),
    });
    await expectStatus(res, 401);
  });
});
