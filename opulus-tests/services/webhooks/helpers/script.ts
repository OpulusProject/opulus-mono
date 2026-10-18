import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Run one of the webhooks service's scripts the way an operator would
 * (`pnpm --filter @opulus/webhooks <script> <args>`), against the test
 * database and the Plaid stub this suite already runs with. Resolves with the
 * exit code and everything it printed, whether it succeeded or not.
 */
export async function runWebhooksScript(
  script: "reconcile" | "replay" | "fire-webhook",
  args: string[] = [],
  env: Record<string, string | undefined> = {},
): Promise<{ code: number; output: string }> {
  const repoRoot = path.resolve(process.cwd(), "..");
  try {
    const { stdout, stderr } = await run("pnpm", ["--filter", "@opulus/webhooks", script, ...args], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
    });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}
