import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const run = promisify(execFile);
const repoRoot = path.resolve(process.cwd(), "..");

/** The services that ship as an image: the port each listens on, and the line it logs when it has stopped cleanly. */
const allServices = [
  { name: "backend", port: 8080, hostPort: 18401, stopped: "Shut down gracefully" },
  { name: "webhooks", port: 8081, hostPort: 18402, stopped: "Server closed" },
  { name: "scheduler", port: 8082, hostPort: 18403, stopped: "Server closed" },
];

/**
 * Which of them to test: all by default, or the comma-separated names in
 * IMAGE_SERVICES (CI tests only the images whose inputs changed). With
 * IMAGES_PREBUILT set, the images are already built and tagged
 * `opulus-deployment-test-<name>` (CI builds them with a layer cache), so the
 * suite does not build them.
 */
const wanted = process.env.IMAGE_SERVICES?.split(",").map((name) => name.trim()).filter(Boolean);
const services = allServices.filter((service) => !wanted || wanted.includes(service.name));
const prebuilt = Boolean(process.env.IMAGES_PREBUILT);

/** An address the container can reach on the host (it cannot reach "localhost"). */
const forContainer = (value: string) =>
  value.replace(/localhost|127\.0\.0\.1/g, "host.docker.internal");

const docker = (...args: string[]) => run("docker", args, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 });

/**
 * This file: each service's Docker image builds, starts the way a platform
 * starts it (the image's own CMD, migrations included), reports ready, and
 * stops cleanly when the platform stops it. The services' own specs run from
 * source with tsx, so none of these would notice a broken Dockerfile.
 */
for (const service of services) {
  test.describe(`${service.name} image`, () => {
    const image = `opulus-deployment-test-${service.name}`;
    const container = `${image}-run`;

    test.beforeAll(async () => {
      test.setTimeout(900_000);
      if (prebuilt) return;
      await docker("build", "-f", `opulus-${service.name}/Dockerfile`, "-t", image, ".");
    });

    test.afterAll(async () => {
      await docker("rm", "-f", container).catch(() => undefined);
    });

    test("starts and reports ready, then stops cleanly when told to", async () => {
      test.setTimeout(180_000);
      // Arrange
      await docker("rm", "-f", container).catch(() => undefined);
      const env = {
        DATABASE_URL: forContainer(process.env.DATABASE_URL ?? ""),
        REDIS_HOST: forContainer(process.env.REDIS_HOST ?? "localhost"),
        REDIS_PORT: process.env.REDIS_PORT ?? "6379",
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "image-test-secret",
        CLIENT_URL: process.env.CLIENT_URL ?? "http://localhost:5173",
        PLAID_CLIENT_ID: "ci-test",
        PLAID_SECRET: "ci-test",
        PLAID_ENV: "sandbox",
        NODE_ENV: "test",
        SCHEDULER_RUN_ON_START: "false",
      };
      await docker(
        "run", "-d", "--name", container,
        "--add-host", "host.docker.internal:host-gateway",
        "-p", `${service.hostPort}:${service.port}`,
        ...Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
        image,
      );

      // Act: wait for the image's own start-up (migrations first) to finish.
      let ready = 0;
      for (let i = 0; i < 90 && ready !== 200; i++) {
        ready = await fetch(`http://localhost:${service.hostPort}/ready`)
          .then((response) => response.status)
          .catch(() => 0);
        if (ready !== 200) await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      const logs = (await docker("logs", container)).stdout;

      // Assert: ready.
      expect(ready, logs).toBe(200);

      // Act: stop it as a platform does (SIGTERM to the container, then a grace period).
      const started = Date.now();
      await docker("stop", "--time", "20", container);
      const exitCode = (await docker("inspect", "-f", "{{.State.ExitCode}}", container)).stdout.trim();

      // Assert: it exited 0 and logged its clean stop, so the signal reached the server (not a
      // kill after the grace period, which is exit 137).
      expect(exitCode).toBe("0");
      expect((await docker("logs", container)).stdout).toContain(service.stopped);
      expect(Date.now() - started).toBeLessThan(15_000);
    });
  });
}
