import { expect, test } from "@playwright/test";
import { extractSessionCookie, uniqueEmail, withSession } from "../helpers/client.js";
import { expectOk } from "../helpers/assertions.js";
import { TEST_PASSWORD, signUp } from "../helpers/fixtures/index.js";

/**
 * This file: the better-auth email sign-up endpoint.
 */
test.describe("POST /api/auth/sign-up/email", () => {
  test("creates an account and issues a session a follow-up read accepts", async ({
    request,
  }) => {
    // Arrange
    const email = uniqueEmail();

    // Act
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email, password: TEST_PASSWORD, name: "Ada Lovelace" },
    });

    // Assert: status + body, then the session side effect via an API read.
    await expectOk(res);
    const body = await res.json();
    expect(body.user).toMatchObject({ email, name: "Ada Lovelace" });
    expect(body.user.id).toBeTruthy();

    const session = await request.get("/api/session", {
      headers: withSession(extractSessionCookie(res)),
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

  test("rejects a password below the minimum length (boundary)", async ({
    request,
  }) => {
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email: uniqueEmail(), password: "x", name: "Shorty" },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("rejects a duplicate email (conflict)", async ({ request }) => {
    // Arrange: an account that already exists.
    const existing = await signUp(request);

    // Act
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email: existing.email, password: TEST_PASSWORD, name: "Twin" },
    });

    // Assert
    expect([400, 409, 422]).toContain(res.status());
  });
});
