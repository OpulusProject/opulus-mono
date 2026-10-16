import { expect, test } from "@playwright/test";
import {
  extractSessionCookie,
  setsSessionCookie,
  uniqueIp,
  withSession,
} from "../../../shared/client.js";
import {
  expectErrorCode,
  expectOk,
  expectStatus,
} from "../../../shared/assertions.js";
import {
  createUserWithTwoFactor,
  currentTotp,
  startTwoFactorSignIn,
  wrongTotp,
} from "../../../shared/fixtures/index.js";

/** The headers of the second step: the challenge cookie from the password step. */
const challenge = (cookie: string) => ({
  cookie,
  "x-forwarded-for": uniqueIp(),
});

/**
 * This file: the second step of signing in as a user with two-factor on. The
 * password step answers with a challenge cookie and no session (see
 * signin.spec.ts); the user then proves the second factor with an
 * authenticator code or one of their backup codes, and only then is a session
 * issued. Codes are computed offline from the secret `enable` returned.
 */
test.describe("signing in with two-factor", () => {
  test.describe("POST /api/auth/two-factor/verify-totp (second step)", () => {
    test("issues a session for a correct authenticator code", async ({
      request,
    }) => {
      // Arrange
      const user = await createUserWithTwoFactor(request);
      const { challengeCookie } = await startTwoFactorSignIn(request, user);

      // Act
      const res = await request.post("/api/auth/two-factor/verify-totp", {
        headers: challenge(challengeCookie),
        data: { code: currentTotp(user.totpUri) },
      });

      // Assert: the session it issued is accepted, and is this user's.
      await expectOk(res);
      const session = await request.get("/api/session", {
        headers: withSession(extractSessionCookie(res)),
      });
      await expectOk(session);
      expect((await session.json()).data.user.id).toBe(user.user.id);
    });

    test("rejects a wrong code (401) and issues no session", async ({
      request,
    }) => {
      // Arrange
      const user = await createUserWithTwoFactor(request);
      const { challengeCookie } = await startTwoFactorSignIn(request, user);

      // Act
      const res = await request.post("/api/auth/two-factor/verify-totp", {
        headers: challenge(challengeCookie),
        data: { code: wrongTotp(user.totpUri) },
      });

      // Assert
      await expectStatus(res, 401);
      expect(setsSessionCookie(res)).toBe(false);
    });

    test("locks the second factor after ten wrong codes in a row, even for the right one (429)", async ({
      request,
    }) => {
      // Arrange
      const user = await createUserWithTwoFactor(request);

      // Act: ten wrong codes, each on a new challenge (a challenge allows only
      // a few wrong codes itself) from an address of its own, so only the
      // per-account lockout is in play, not the per-address rate limit.
      for (let attempt = 0; attempt < 10; attempt++) {
        const { challengeCookie } = await startTwoFactorSignIn(request, user);
        const wrong = await request.post("/api/auth/two-factor/verify-totp", {
          headers: challenge(challengeCookie),
          data: { code: wrongTotp(user.totpUri) },
        });
        await expectStatus(wrong, 401);
      }
      const { challengeCookie } = await startTwoFactorSignIn(request, user);
      const right = await request.post("/api/auth/two-factor/verify-totp", {
        headers: challenge(challengeCookie),
        data: { code: currentTotp(user.totpUri) },
      });

      // Assert
      await expectStatus(right, 429);
      await expectErrorCode(right, "ACCOUNT_TEMPORARILY_LOCKED");
      expect(setsSessionCookie(right)).toBe(false);
    });

    test("a challenge allows only a few wrong codes, then a new one is needed (400)", async ({
      request,
    }) => {
      // Arrange
      const user = await createUserWithTwoFactor(request);
      const { challengeCookie } = await startTwoFactorSignIn(request, user);

      // Act: keep guessing on the same challenge.
      let last = await request.post("/api/auth/two-factor/verify-totp", {
        headers: challenge(challengeCookie),
        data: { code: wrongTotp(user.totpUri) },
      });
      for (let attempt = 0; attempt < 5 && last.status() === 401; attempt++) {
        last = await request.post("/api/auth/two-factor/verify-totp", {
          headers: challenge(challengeCookie),
          data: { code: wrongTotp(user.totpUri) },
        });
      }

      // Assert: it stops answering "wrong code" and asks for a new challenge;
      // the challenge is spent, so even the right code on it is refused.
      await expectStatus(last, 400);
      await expectErrorCode(last, "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE");
      const right = await request.post("/api/auth/two-factor/verify-totp", {
        headers: challenge(challengeCookie),
        data: { code: currentTotp(user.totpUri) },
      });
      await expectStatus(right, 401);
      await expectErrorCode(right, "INVALID_TWO_FACTOR_COOKIE");
      expect(setsSessionCookie(right)).toBe(false);
    });
  });

  test.describe("POST /api/auth/two-factor/verify-backup-code (second step)", () => {
    test("issues a session for an unused backup code", async ({ request }) => {
      // Arrange
      const user = await createUserWithTwoFactor(request);
      const { challengeCookie } = await startTwoFactorSignIn(request, user);

      // Act
      const res = await request.post("/api/auth/two-factor/verify-backup-code", {
        headers: challenge(challengeCookie),
        data: { code: user.backupCodes[0] },
      });

      // Assert
      await expectOk(res);
      const session = await request.get("/api/session", {
        headers: withSession(extractSessionCookie(res)),
      });
      await expectOk(session);
    });

    test("works once: the same code is rejected the next time (401)", async ({
      request,
    }) => {
      // Arrange: a backup code used to sign in.
      const user = await createUserWithTwoFactor(request);
      const code = user.backupCodes[0];
      const first = await startTwoFactorSignIn(request, user);
      await expectOk(
        await request.post("/api/auth/two-factor/verify-backup-code", {
          headers: challenge(first.challengeCookie),
          data: { code },
        }),
      );

      // Act: sign in again and try the same code.
      const second = await startTwoFactorSignIn(request, user);
      const again = await request.post("/api/auth/two-factor/verify-backup-code", {
        headers: challenge(second.challengeCookie),
        data: { code },
      });

      // Assert
      await expectStatus(again, 401);
      expect(setsSessionCookie(again)).toBe(false);
    });

    test("rejects a code that was never issued (401)", async ({ request }) => {
      // Arrange
      const user = await createUserWithTwoFactor(request);
      const { challengeCookie } = await startTwoFactorSignIn(request, user);

      // Act
      const res = await request.post("/api/auth/two-factor/verify-backup-code", {
        headers: challenge(challengeCookie),
        data: { code: "not-a-real-code" },
      });

      // Assert
      await expectStatus(res, 401);
    });
  });

  test.describe("POST /api/auth/two-factor/generate-backup-codes", () => {
    test("requires authentication (401)", async ({ request }) => {
      const res = await request.post("/api/auth/two-factor/generate-backup-codes", {
        data: { password: "irrelevant" },
      });
      await expectStatus(res, 401);
    });

    test("rejects a wrong password (400)", async ({ request }) => {
      // Arrange
      const user = await createUserWithTwoFactor(request);

      // Act
      const res = await request.post("/api/auth/two-factor/generate-backup-codes", {
        headers: withSession(user.cookie),
        data: { password: "not-the-password" },
      });

      // Assert
      await expectStatus(res, 400);
    });

    test("replaces the codes: new ones are returned and the old ones stop working", async ({
      request,
    }) => {
      // Arrange
      const user = await createUserWithTwoFactor(request);

      // Act
      const res = await request.post("/api/auth/two-factor/generate-backup-codes", {
        headers: withSession(user.cookie),
        data: { password: user.password },
      });

      // Assert: a fresh set, none of the old ones among them...
      await expectOk(res);
      const { backupCodes } = await res.json();
      expect(backupCodes).toHaveLength(user.backupCodes.length);
      expect(backupCodes.filter((c: string) => user.backupCodes.includes(c))).toEqual([]);

      // ...and an old code no longer signs in, while a new one does.
      const stale = await startTwoFactorSignIn(request, user);
      await expectStatus(
        await request.post("/api/auth/two-factor/verify-backup-code", {
          headers: challenge(stale.challengeCookie),
          data: { code: user.backupCodes[0] },
        }),
        401,
      );
      const fresh = await startTwoFactorSignIn(request, user);
      await expectOk(
        await request.post("/api/auth/two-factor/verify-backup-code", {
          headers: challenge(fresh.challengeCookie),
          data: { code: backupCodes[0] },
        }),
      );
    });
  });
});
