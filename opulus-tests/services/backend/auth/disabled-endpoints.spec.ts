import { test } from "@playwright/test";
import { uniqueIp, withSession } from "../../../shared/client.js";
import { expectStatus } from "../../../shared/assertions.js";
import { createUserWithTwoFactor } from "../../../shared/fixtures/index.js";

/**
 * Better Auth mounts every route its core and plugins define; the backend only
 * serves the ones in src/authEndpoints.ts, and the rest answer 404. These are
 * the ones that were switched off, each with its own method, with and without a
 * signed-in user (a 401 would mean the route exists and wants a login).
 */
const DISABLED: Array<{ method: "GET" | "POST"; path: string; why: string }> = [
  // Two-factor can not be turned off or read back, and has no email or text codes
  { method: "POST", path: "/two-factor/disable", why: "required of every user" },
  { method: "POST", path: "/two-factor/get-totp-uri", why: "the secret is shown once" },
  { method: "POST", path: "/two-factor/send-otp", why: "no email or text codes" },
  { method: "POST", path: "/two-factor/verify-otp", why: "no email or text codes" },

  // No social providers
  { method: "POST", path: "/sign-in/social", why: "no provider" },
  { method: "GET", path: "/callback/github", why: "no provider" },
  { method: "POST", path: "/callback/github", why: "no provider" },
  { method: "POST", path: "/link-social", why: "no provider" },
  { method: "POST", path: "/unlink-account", why: "no provider" },
  { method: "GET", path: "/list-accounts", why: "no provider" },
  { method: "POST", path: "/get-access-token", why: "no provider" },
  { method: "POST", path: "/refresh-token", why: "no provider" },
  { method: "GET", path: "/account-info", why: "no provider" },

  // No email provider
  { method: "POST", path: "/request-password-reset", why: "no email" },
  { method: "POST", path: "/reset-password", why: "no email" },
  { method: "GET", path: "/reset-password/some-token", why: "no email" },
  { method: "POST", path: "/send-verification-email", why: "no email" },
  { method: "GET", path: "/verify-email", why: "no email" },
  { method: "POST", path: "/change-email", why: "no email" },
  { method: "GET", path: "/delete-user/callback", why: "deletion takes the password, not an email link" },

  // Nothing calls these yet
  { method: "POST", path: "/update-user", why: "not used yet" },
  { method: "POST", path: "/update-session", why: "not used yet" },
  { method: "POST", path: "/verify-password", why: "not used yet" },
  { method: "GET", path: "/ok", why: "not used" },
  { method: "GET", path: "/error", why: "not used" },
];

/**
 * This file: the Better Auth routes that are switched off answer 404.
 */
test.describe("auth routes that are switched off", () => {
  for (const { method, path, why } of DISABLED) {
    test(`${method} /api/auth${path} answers 404 (${why})`, async ({ request }) => {
      // Arrange: a signed-in user (two-factor on, as every user will be).
      const user = await createUserWithTwoFactor(request);
      const send = (headers: Record<string, string>) =>
        request.fetch(`/api/auth${path}`, {
          method,
          headers,
          ...(method === "POST" ? { data: {} } : {}),
        });

      // Act + Assert: gone for a signed-in user, and for nobody alike.
      await expectStatus(await send(withSession(user.cookie)), 404);
      await expectStatus(await send({ "x-forwarded-for": uniqueIp() }), 404);
    });
  }
});
