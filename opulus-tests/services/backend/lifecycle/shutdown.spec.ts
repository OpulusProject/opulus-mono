import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { expect, test } from "@playwright/test";

/** The port the second backend of this file listens on (the suite's own stays up). */
const PORT = 18291;

/** Start a second backend on its own port, and wait until it answers. */
async function startBackend(): Promise<{ child: ChildProcess; output: () => string }> {
  const cwd = path.resolve(process.cwd(), "../opulus-backend");
  const child = spawn(path.join(cwd, "node_modules/.bin/tsx"), ["src/server.ts"], {
    cwd,
    env: { ...process.env, PORT: String(PORT) },
  });
  let text = "";
  child.stdout?.on("data", (chunk) => (text += chunk));
  child.stderr?.on("data", (chunk) => (text += chunk));

  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/health`)).ok) break;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return { child, output: () => text };
}

/** Wait for a process to exit; its exit code. */
function exited(child: ChildProcess, timeoutMs = 15_000): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("did not exit in time")), timeoutMs);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

/**
 * This file: the backend stops cleanly on SIGTERM, as a deploy asks it to. It
 * starts a second backend on its own port (the suite's own must stay up) and
 * stops that one.
 */
test.describe("graceful shutdown", () => {
  test("exits cleanly on SIGTERM and stops accepting connections", async () => {
    // Arrange
    const { child, output } = await startBackend();

    // Act
    child.kill("SIGTERM");
    const code = await exited(child);

    // Assert
    expect(code).toBe(0);
    expect(output()).toContain("Shutting down gracefully");
    expect(output()).toContain("Shut down gracefully");
    await expect(fetch(`http://localhost:${PORT}/health`)).rejects.toThrow();
  });

  test("lets a request that is already running finish before it exits", async () => {
    // Arrange: a sign-in request whose body is half sent when the signal arrives.
    const { child } = await startBackend();
    const body = JSON.stringify({ email: "nobody@example.test", password: "irrelevant-password" });
    const socket = net.connect(PORT, "localhost");
    await new Promise<void>((resolve) => socket.once("connect", resolve));
    socket.write(
      `POST /api/auth/sign-in/email HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\n` +
        `Origin: ${process.env.CLIENT_URL ?? "http://localhost:5173"}\r\nConnection: close\r\n` +
        `Content-Length: ${body.length}\r\n\r\n${body.slice(0, 10)}`,
    );
    let response = "";
    socket.on("data", (chunk) => (response += chunk));
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Act: ask the server to stop, then finish the request.
    child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 300));
    socket.write(body.slice(10));
    const code = await exited(child);

    // Assert: it answered the request (a wrong login is a 401) and then exited cleanly.
    expect(response).toMatch(/^HTTP\/1\.1 401/);
    expect(code).toBe(0);
    socket.destroy();
  });
});
