import { test } from "@playwright/test";
import { withSession } from "../helpers/client.js";
import { expectOk, expectStatus } from "../helpers/assertions.js";
import {
  createAuthedUser,
  currentTotp,
  enableTwoFactor,
} from "../helpers/fixtures/index.js";

/**
 * This file: the better-auth 2FA verify-totp endpoint. With an authenticated
 * session and a freshly-enabled secret, a correct computed code confirms
 * enrollment; a wrong code is rejected. TOTP codes are generated offline from
 * the enable response's otpauth URI (see helpers/fixtures/two-factor.ts).
 */
test.describe("POST /api/auth/two-factor/verify-totp", () => {
  test("confirms enrollment with a valid TOTP code", async ({ request }) => {
    // Arrange: authenticate, then provision a 2FA secret.
    const { cookie } = await createAuthedUser(request);
    const { totpUri } = await enableTwoFactor(request, cookie);

    // Act
    const res = await request.post("/api/auth/two-factor/verify-totp", {
      headers: withSession(cookie),
      data: { code: currentTotp(totpUri) },
    });

    // Assert
    await expectOk(res);
  });

  test("rejects an invalid TOTP code (401)", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);
    await enableTwoFactor(request, cookie);

    const res = await request.post("/api/auth/two-factor/verify-totp", {
      headers: withSession(cookie),
      data: { code: "000000" },
    });

    await expectStatus(res, 401);
  });
});
