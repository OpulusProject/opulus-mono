import { expect, test } from "@playwright/test";
import { uniqueEmail, withSession } from "./helpers/client.js";
import { expectOk, expectStatus } from "./helpers/assertions.js";
import { TEST_PASSWORD, signIn, signUp } from "./helpers/fixtures.js";

/**
 * better-auth email/password surface. This is the entry point for every other
 * authenticated flow, so it gets the fullest coverage: happy path, a follow-up
 * read that proves the session works, plus the validation / conflict / bad-
 * credential branches.
 */

test.describe("POST /api/auth/sign-up/email", () => {
  test("creates an account, issues a session, and a follow-up read reflects it (happy path)", async ({
    request,
  }) => {
    const email = uniqueEmail();
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email, password: TEST_PASSWORD, name: "Ada Lovelace" },
    });
    await expectOk(res);

    const body = await res.json();
    expect(body.user).toMatchObject({ email, name: "Ada Lovelace" });
    expect(body.user.id).toBeTruthy();

    // The issued session must authorize a protected read.
    const cookie = res
      .headersArray()
      .filter((h) => h.name.toLowerCase() === "set-cookie")
      .map((h) => h.value.split(";")[0])
      .find((c) => c.includes("session_token"));
    expect(cookie).toBeTruthy();

    const session = await request.get("/api/session", {
      headers: withSession(cookie as string),
    });
    await expectOk(session);
    expect((await session.json()).data.user.email).toBe(email);
  });

  test("rejects a malformed email", async ({ request }) => {
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email: "not-an-email", password: TEST_PASSWORD, name: "Nope" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("rejects a password below the minimum length", async ({ request }) => {
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email: uniqueEmail(), password: "x", name: "Shorty" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("rejects a duplicate email (conflict)", async ({ request }) => {
    const user = await signUp(request);
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email: user.email, password: TEST_PASSWORD, name: "Twin" },
    });
    expect([400, 409, 422]).toContain(res.status());
  });
});

test.describe("POST /api/auth/sign-in/email", () => {
  test("authenticates a registered user (happy path)", async ({ request }) => {
    const user = await signUp(request);
    const { cookie, user: signedIn } = await signIn(request, user.email);
    expect(cookie).toContain("session_token");
    expect(signedIn.email).toBe(user.email);
  });

  test("rejects a wrong password (401)", async ({ request }) => {
    const user = await signUp(request);
    const res = await request.post("/api/auth/sign-in/email", {
      data: { email: user.email, password: "wrong-password" },
    });
    await expectStatus(res, 401);
  });

  test("rejects an unknown account (401)", async ({ request }) => {
    const res = await request.post("/api/auth/sign-in/email", {
      data: { email: uniqueEmail(), password: TEST_PASSWORD },
    });
    await expectStatus(res, 401);
  });
});
