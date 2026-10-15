import { expect, test } from "@playwright/test";
import { expectStatus } from "../../../shared/assertions.js";
import {
  cookiesFrom,
  extractSessionCookie,
  uniqueIp,
  withSession,
} from "../../../shared/client.js";
import { testDb } from "../../../shared/db.js";
import {
  authenticationResponse,
  createVirtualAuthenticator,
  registerPasskey,
  signInWithPasskey,
  signUp,
} from "../../../shared/fixtures/index.js";

/**
 * This file: passkeys (WebAuthn). A software authenticator (see the passkey
 * fixture) makes the same responses a device would, so registration, signing in
 * and managing passkeys run end to end over HTTP without a browser.
 */
test.describe("passkeys", () => {
  test("registers a passkey for the signed-in user and lists it", async ({
    request,
  }) => {
    // Arrange
    const user = await signUp(request);
    const authenticator = createVirtualAuthenticator();

    // Act
    const passkey = await registerPasskey(request, user.cookie, authenticator, "Laptop");
    const list = await request.get("/api/auth/passkey/list-user-passkeys", {
      headers: withSession(user.cookie),
    });

    // Assert
    expect(passkey).toMatchObject({ name: "Laptop", userId: user.user.id });
    await expectStatus(list, 200);
    expect(await list.json()).toMatchObject([{ id: passkey.id, name: "Laptop" }]);
  });

  test("requires a session to register (401)", async ({ request }) => {
    const res = await request.get("/api/auth/passkey/generate-register-options", {
      headers: { "x-forwarded-for": uniqueIp() },
    });

    await expectStatus(res, 401);
  });

  test("requires a fresh session to register: an old sign-in cannot enroll a device", async ({
    request,
  }) => {
    // Arrange: a session that was created ten minutes ago (fresh is five).
    const user = await signUp(request);
    await testDb().session.updateMany({
      where: { userId: user.user.id },
      data: { createdAt: new Date(Date.now() - 10 * 60 * 1000) },
    });

    // Act
    const res = await request.get("/api/auth/passkey/generate-register-options", {
      headers: withSession(user.cookie),
    });

    // Assert
    await expectStatus(res, 403);
    expect(await testDb().passkey.count({ where: { userId: user.user.id } })).toBe(0);
  });

  test("signs in with a registered passkey, without a password", async ({
    request,
  }) => {
    // Arrange
    const user = await signUp(request);
    const authenticator = createVirtualAuthenticator();
    await registerPasskey(request, user.cookie, authenticator);

    // Act
    const res = await signInWithPasskey(request, authenticator);

    // Assert: a session for that user.
    await expectStatus(res, 200);
    const session = await request.get("/api/session", {
      headers: withSession(extractSessionCookie(res)),
    });
    await expectStatus(session, 200);
    expect((await session.json()).data.user.id).toBe(user.user.id);
  });

  test("refuses a passkey that was never registered (401)", async ({ request }) => {
    const res = await signInWithPasskey(request, createVirtualAuthenticator());

    await expectStatus(res, 401);
  });

  test("refuses a passkey used without user verification (401)", async ({
    request,
  }) => {
    // Arrange
    const user = await signUp(request);
    const authenticator = createVirtualAuthenticator();
    await registerPasskey(request, user.cookie, authenticator);

    // Act: the device was touched but the user was not verified (no PIN or biometric).
    const res = await signInWithPasskey(request, authenticator, {
      userVerified: false,
    });

    // Assert
    await expectStatus(res, 401);
    expect((await res.json()).code).toBe("USER_VERIFICATION_REQUIRED");
  });

  test("a challenge can be answered only once", async ({ request }) => {
    // Arrange: ask for a challenge and answer it.
    const user = await signUp(request);
    const authenticator = createVirtualAuthenticator();
    await registerPasskey(request, user.cookie, authenticator);
    const headers = { "x-forwarded-for": uniqueIp() };
    const optionsRes = await request.get(
      "/api/auth/passkey/generate-authenticate-options",
      { headers },
    );
    const options = await optionsRes.json();
    const answer = () =>
      request.post("/api/auth/passkey/verify-authentication", {
        headers: { ...headers, cookie: cookiesFrom(optionsRes) },
        data: { response: authenticationResponse(authenticator, options) },
      });

    // Act
    const first = await answer();
    const second = await answer();

    // Assert
    await expectStatus(first, 200);
    expect(second.ok()).toBe(false);
  });

  test("deletes a passkey of one's own, and signing in with it then fails", async ({
    request,
  }) => {
    // Arrange
    const user = await signUp(request);
    const authenticator = createVirtualAuthenticator();
    const passkey = await registerPasskey(request, user.cookie, authenticator);

    // Act
    const res = await request.post("/api/auth/passkey/delete-passkey", {
      headers: withSession(user.cookie),
      data: { id: passkey.id },
    });

    // Assert
    await expectStatus(res, 200);
    await expectStatus(await signInWithPasskey(request, authenticator), 401);
  });

  test("cannot see or delete another user's passkey", async ({ request }) => {
    // Arrange
    const owner = await signUp(request);
    const intruder = await signUp(request);
    const passkey = await registerPasskey(request, owner.cookie, createVirtualAuthenticator());

    // Act
    const list = await request.get("/api/auth/passkey/list-user-passkeys", {
      headers: withSession(intruder.cookie),
    });
    const del = await request.post("/api/auth/passkey/delete-passkey", {
      headers: withSession(intruder.cookie),
      data: { id: passkey.id },
    });

    // Assert: it is not listed, and the delete is refused and changes nothing.
    expect(await list.json()).toEqual([]);
    expect(del.ok()).toBe(false);
    expect(await testDb().passkey.count({ where: { userId: owner.user.id } })).toBe(1);
  });
});
