import { expect, test } from "@playwright/test";
import { withSession } from "../helpers/client.js";
import { expectOk, expectStatus } from "../helpers/assertions.js";
import { TEST_PASSWORD, createAuthedUser } from "../helpers/fixtures/index.js";

/**
 * This file: the better-auth 2FA enable endpoint. Enable provisions a TOTP
 * secret for the authenticated user; it does not protect the account until a
 * verify-totp confirms it (see two-factor-verify.spec.ts).
 */
test.describe("POST /api/auth/two-factor/enable", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/auth/two-factor/enable", {
      data: { password: TEST_PASSWORD },
    });
    await expectStatus(res, 401);
  });

  test("rejects an incorrect password (400)", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    const res = await request.post("/api/auth/two-factor/enable", {
      headers: withSession(cookie),
      data: { password: "wrong-password" },
    });

    await expectStatus(res, 400);
  });

  test("returns a TOTP URI and backup codes for the authenticated user", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);

    const res = await request.post("/api/auth/two-factor/enable", {
      headers: withSession(cookie),
      data: { password: TEST_PASSWORD },
    });

    await expectOk(res);
    const body = await res.json();
    expect(body.totpURI).toContain("otpauth://totp/");
    expect(Array.isArray(body.backupCodes)).toBe(true);
    expect(body.backupCodes.length).toBeGreaterThan(0);
  });
});
