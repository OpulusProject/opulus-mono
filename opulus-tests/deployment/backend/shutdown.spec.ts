import net from "node:net";
import { expect, test } from "@playwright/test";
import { exited, startService } from "../helpers/service.js";

/** The port the backend of this file listens on. */
const PORT = 18291;

const startBackend = () => startService({ workspace: "opulus-backend", port: PORT, portVariable: "PORT" });

/**
 * This file: the backend stops cleanly on SIGTERM, as a deploy asks it to. It
 * starts a backend of its own and stops that one.
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
