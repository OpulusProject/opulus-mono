/**
 * The Better Auth routes this app serves, under /api/auth. Better Auth mounts
 * every route its core and plugins define, whether or not anything uses them,
 * and adds more when it is upgraded. Anything not listed here answers 404, so
 * a route is switched on by adding it here, together with the feature that
 * needs it and a spec for it.
 *
 * Left off on purpose (see the comments by each group):
 * - `/two-factor/disable`: two-factor is required of every user, so there is no
 *   way to turn it off. Changing authenticator needs its own flow that proves
 *   the old factor first; plain `disable` would leave the account without one.
 * - `/two-factor/get-totp-uri`: shows the secret again for a password. It is
 *   shown once, when it is set up.
 * - `/two-factor/send-otp` and `verify-otp`: codes by email or text; neither is
 *   set up.
 * - Social sign-in, linked accounts and their tokens: no provider is configured.
 * - Email flows (reset password, verify email, change email): there is no email
 *   provider yet. Switch the ones that are needed on with it.
 * - `update-user`, `update-session`, `verify-password`, `account-info`, `ok`,
 *   `error`: nothing calls them yet.
 */
export const ALLOWED_AUTH_PATHS: ReadonlySet<string> = new Set([
  // Signing in and out, and the session the client reads
  "/sign-up/email",
  "/sign-in/email",
  "/sign-out",
  "/get-session",

  // The account
  "/change-password",
  "/delete-user",

  // Where the user is signed in
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",

  // Two-factor: enrolling, and the second step of signing in
  "/two-factor/enable",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/two-factor/generate-backup-codes",

  // Passkeys
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/passkey/generate-authenticate-options",
  "/passkey/verify-authentication",
  "/passkey/list-user-passkeys",
  "/passkey/update-passkey",
  "/passkey/delete-passkey",
]);
