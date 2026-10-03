#!/usr/bin/env node
/**
 * One-command local dev:
 *   1. Open a zrok tunnel to the webhooks service (http://localhost:8081).
 *   2. Export PLAID_WEBHOOK_URL as `<tunnel>/webhook/plaid`.
 *   3. Run core, backend, webhooks, and frontend in watch mode.
 *
 * Local Postgres and Redis come from `docker compose up -d` (unchanged).
 */
import { spawn } from "node:child_process";
import { once } from "node:events";
import process from "node:process";

const WEBHOOK_LOCAL = "http://localhost:8081";

const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (!c.killed) c.kill("SIGINT");
  }
  setTimeout(() => process.exit(code), 500);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function run(command, args, opts = {}) {
  const child = spawn(command, args, {
    stdio: opts.stdio ?? "inherit",
    env: { ...process.env, ...(opts.env ?? {}) },
    shell: false,
  });
  children.push(child);
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`[dev] ${command} ${args.join(" ")} exited with ${code}`);
      shutdown(code ?? 1);
    }
  });
  return child;
}

async function startZrokShare() {
  const child = spawn(
    "zrok",
    ["share", "public", WEBHOOK_LOCAL, "--headless", "--backend-mode", "web"],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  children.push(child);

  let url = "";
  const urlRe = /https:\/\/[^\s"]+\.zrok\.io/;

  const pipe = (stream, prefix) => {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      process.stdout.write(`[zrok] ${chunk}`);
      if (!url) {
        const match = chunk.match(urlRe);
        if (match) {
          url = match[0];
          child.emit("url", url);
        }
      }
    });
  };
  pipe(child.stdout, "stdout");
  pipe(child.stderr, "stderr");

  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`[dev] zrok exited with ${code}`);
      shutdown(code ?? 1);
    }
  });

  const timeout = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error("zrok did not publish a URL in 30s")),
      30_000
    )
  );
  await Promise.race([once(child, "url"), timeout]);
  return url;
}

async function main() {
  const tunnel = await startZrokShare();
  const webhookUrl = `${tunnel.replace(/\/$/, "")}/webhook/plaid`;
  console.log(`[dev] PLAID_WEBHOOK_URL=${webhookUrl}`);

  run(
    "pnpm",
    [
      "exec",
      "concurrently",
      "--names",
      "core,backend,webhooks,frontend",
      "--prefix-colors",
      "blue,green,yellow,magenta",
      "pnpm --filter @opulus/core dev",
      "pnpm --filter @opulus/backend dev",
      "pnpm --filter @opulus/webhooks dev",
      "pnpm --filter @opulus/frontend dev",
    ],
    { env: { PLAID_WEBHOOK_URL: webhookUrl } }
  );
}

main().catch((err) => {
  console.error(err);
  shutdown(1);
});
