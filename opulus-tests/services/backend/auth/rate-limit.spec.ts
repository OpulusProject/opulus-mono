import { expect, test, type APIRequestContext } from "@playwright/test";
import { expectStatus } from "../../../shared/assertions.js";
import { uniqueEmail, uniqueIp } from "../../../shared/client.js";
import { TEST_PASSWORD } from "../../../shared/fixtures/index.js";

/** A sign-in with a wrong password, from the given X-Forwarded-For. */
function wrongSignIn(request: APIRequestContext, forwardedFor: string) {
  return request.post("/api/auth/sign-in/email", {
    headers: { "x-forwarded-for": forwardedFor },
    data: { email: uniqueEmail(), password: TEST_PASSWORD },
  });
}

/**
 * This file: Better Auth's rate limits on the auth routes, as configured in
 * auth.ts (5 sign-ins a minute, 10 sign-ups an hour, 5 two-factor codes a
 * minute, per client address). Each test uses an address of its own, so its
 * counters start empty and never touch another spec's.
 */
test.describe("auth rate limiting", () => {
  test("answers 429 after five sign-in attempts from one address in a minute", async ({
    request,
  }) => {
    // Arrange
    const address = uniqueIp();

    // Act: five attempts are answered (wrong password, 401)...
    for (let i = 0; i < 5; i++) {
      await expectStatus(await wrongSignIn(request, address), 401);
    }
    const limited = await wrongSignIn(request, address);

    // Assert: ...the sixth is told to wait.
    await expectStatus(limited, 429);
    expect(await limited.json()).toMatchObject({
      message: "Too many requests. Please try again later.",
    });
    expect(Number(limited.headers()["x-retry-after"])).toBeGreaterThan(0);
  });

  test("counts each address on its own", async ({ request }) => {
    // Arrange: one address uses up its sign-ins.
    const busy = uniqueIp();
    for (let i = 0; i < 6; i++) await wrongSignIn(request, busy);

    // Act: a different address still gets an ordinary answer.
    const res = await wrongSignIn(request, uniqueIp());

    // Assert
    await expectStatus(res, 401);
  });

  test("counts the address the proxy saw, not one the caller writes", async ({
    request,
  }) => {
    // Arrange: the caller puts a different address first on every request, and
    // the proxy (here, the test itself) adds the real one at the end.
    const real = uniqueIp();
    const spoofed = () => `${uniqueIp()}, ${real}`;

    // Act
    for (let i = 0; i < 5; i++) {
      await expectStatus(await wrongSignIn(request, spoofed()), 401);
    }
    const limited = await wrongSignIn(request, spoofed());

    // Assert: still one counter, so the sixth is limited.
    await expectStatus(limited, 429);
  });

  test("answers 429 after ten sign-ups from one address in an hour", async ({
    request,
  }) => {
    // Arrange
    const address = uniqueIp();
    const signUp = () =>
      request.post("/api/auth/sign-up/email", {
        headers: { "x-forwarded-for": address },
        data: {
          email: uniqueEmail(),
          password: TEST_PASSWORD,
          name: "Rate Limit",
        },
      });

    // Act
    for (let i = 0; i < 10; i++) await expectStatus(await signUp(), 200);
    const limited = await signUp();

    // Assert
    await expectStatus(limited, 429);
  });

  test("answers 429 after five two-factor code attempts from one address in a minute", async ({
    request,
  }) => {
    // Arrange: no two-factor session at all, so every attempt is refused (401)
    // but still counted.
    const address = uniqueIp();
    const verify = () =>
      request.post("/api/auth/two-factor/verify-totp", {
        headers: { "x-forwarded-for": address },
        data: { code: "000000" },
      });

    // Act
    for (let i = 0; i < 5; i++) await expectStatus(await verify(), 401);
    const limited = await verify();

    // Assert
    await expectStatus(limited, 429);
  });
});
