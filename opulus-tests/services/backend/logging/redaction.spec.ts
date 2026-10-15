import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const run = promisify(execFile);

/** Run the logging script and return its one JSON log line. */
async function logLine() {
  const script = path.resolve(process.cwd(), "services/backend/logging/log-secrets.mjs");
  const { stdout } = await run("node", [script], {
    // The production-style logger writes plain JSON lines (development is pretty-printed).
    env: { ...process.env, NODE_ENV: "test", LOG_LEVEL: "info" },
  });
  return { text: stdout, entry: JSON.parse(stdout.trim().split("\n").at(-1)!) };
}

/**
 * This file: what the logger does with secrets. It is the real logger from
 * @opulus/core, run in a child process, and the check is on the line that comes
 * out: credentials, tokens, cookies and emails never reach it, whichever log
 * call put them there.
 */
test.describe("log redaction", () => {
  test("keeps credentials, tokens and cookies out of a log line, at the top level and one level down", async () => {
    const { text } = await logLine();

    for (const secret of [
      "hunter2-top",
      "access-sandbox-top",
      "hunter2-nested",
      "old-hunter2-nested",
      "public-sandbox-nested",
      "link-sandbox-nested",
      "bearer-secret",
      "cookie-secret",
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  test("keeps the user's email out of the logs", async () => {
    const { text } = await logLine();

    expect(text).not.toContain("someone@example.test");
    expect(text).not.toContain("nested@example.test");
  });

  test("still logs what is safe, and says what it took out", async () => {
    const { entry } = await logLine();

    expect(entry).toMatchObject({
      msg: "A request with secrets in it",
      user_id: "user_123",
      plaid_item_id: "item_456",
      user: { name: "Fine To Log" },
      password: "[Redacted]",
      access_token: "[Redacted]",
      body: { newPassword: "[Redacted]" },
    });
  });
});
