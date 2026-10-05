import { test } from "@playwright/test";
import { withSession } from "../../../shared/client.js";
import {
  expectErrorCode,
  expectOk,
  expectStatus,
} from "../../../shared/assertions.js";
import {
  createAuthedUser,
  currentTotp,
  enableTwoFactor,
  wrongTotp,
} from "../../../shared/fixtures/index.js";

/**
 * This file: the better-auth 2FA verify-totp endpoint. With an authenticated
 * session and a freshly-enabled secret, a correct computed code confirms
 * enrollment; a wrong code is rejected. TOTP codes are generated offline from
 * the enable response's otpauth URI (see shared/fixtures/two-factor.ts).
 */
test.describe("POST /api/auth/two-factor/verify-totp", () => {
  test("requires authentication (401, INVALID_TWO_FACTOR_COOKIE)", async ({
    request,
  }) => {
    const res = await request.post("/api/auth/two-factor/verify-totp", {
      data: { code: "000000" },
    });
    await expectStatus(res, 401);
    await expectErrorCode(res, "INVALID_TWO_FACTOR_COOKIE");
  });

  test("rejects an invalid TOTP code (401)", async ({ request }) => {
    // Arrange: authenticated user with a freshly-enabled 2FA secret.
    const { cookie } = await createAuthedUser(request);
    const { totpUri } = await enableTwoFactor(request, cookie);

    // Act: a guaranteed-wrong code for the current window (never the real one).
    const res = await request.post("/api/auth/two-factor/verify-totp", {
      headers: withSession(cookie),
      data: { code: wrongTotp(totpUri) },
    });

    // Assert
    await expectStatus(res, 401);
  });

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
});
