/**
 * Writes one log line through the real logger (from @opulus/core), with
 * credentials, tokens and an email in it. The redaction spec runs this in a
 * child process and reads what reached stdout.
 */
import { logger } from "@opulus/core";

logger.info(
  {
    user_id: "user_123",
    plaid_item_id: "item_456",
    // Top level.
    password: "hunter2-top",
    access_token: "access-sandbox-top",
    email: "someone@example.test",
    // One level down.
    body: {
      newPassword: "hunter2-nested",
      currentPassword: "old-hunter2-nested",
      public_token: "public-sandbox-nested",
      linkToken: "link-sandbox-nested",
    },
    user: { email: "nested@example.test", name: "Fine To Log" },
    headers: { authorization: "Bearer bearer-secret", cookie: "opulus.session_token=cookie-secret" },
  },
  "A request with secrets in it",
);
