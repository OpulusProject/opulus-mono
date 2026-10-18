import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

export interface RunningService {
  child: ChildProcess;
  /** Everything the process has written to stdout and stderr so far. */
  output: () => string;
}

/**
 * Start a service from source, the way the repo does (`tsx src/server.ts`), on
 * a port of its own, and wait until `/health` answers. `env` is added to this
 * process's environment, so a spec can point the service at a dependency that
 * is not there. If the service never answers, it is returned anyway: a spec
 * about a service that fails to come up reads `output()` and the exit code.
 */
export async function startService(options: {
  /** The workspace folder, e.g. `opulus-webhooks`. */
  workspace: string;
  /** The port the service listens on, and the name of the variable that sets it. */
  port: number;
  portVariable: string;
  env?: Record<string, string>;
  /**
   * Start from an empty environment (only PATH and HOME) instead of this
   * process's, for a spec about what the service does when a setting is missing.
   */
  cleanEnv?: boolean;
  /** How long to wait for `/health`. */
  waitMs?: number;
}): Promise<RunningService> {
  const cwd = path.resolve(process.cwd(), "..", options.workspace);
  // Its own process group, so a spec can stop tsx and the service it runs together.
  const child = spawn(path.join(cwd, "node_modules/.bin/tsx"), ["src/server.ts"], {
    cwd,
    detached: true,
    env: {
      ...(options.cleanEnv
        ? { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" }
        : process.env),
      [options.portVariable]: String(options.port),
      ...options.env,
    },
  });
  let text = "";
  child.stdout?.on("data", (chunk) => (text += chunk));
  child.stderr?.on("data", (chunk) => (text += chunk));

  const deadline = Date.now() + (options.waitMs ?? 20_000);
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      if ((await fetch(`http://localhost:${options.port}/health`)).ok) break;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return { child, output: () => text };
}

/** Wait for a process to exit; its exit code. */
export function exited(child: ChildProcess, timeoutMs = 15_000): Promise<number | null> {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("did not exit in time")), timeoutMs);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

/**
 * Stop a service a spec started, whatever state it is in, and everything it
 * started: `tsx` runs the service as a child of its own, which would otherwise
 * be left holding the port. (A spec about how the service shuts down sends
 * SIGTERM itself and waits.)
 */
export async function stopService(service: RunningService): Promise<void> {
  if (service.child.exitCode !== null) return;
  try {
    process.kill(-service.child.pid!, "SIGKILL");
  } catch {
    service.child.kill("SIGKILL");
  }
  await exited(service.child).catch(() => undefined);
}

/** GET a path of a service; the status and the parsed body. */
export async function get(
  port: number,
  pathname: string,
  timeoutMs = 10_000,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`http://localhost:${port}${pathname}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}
