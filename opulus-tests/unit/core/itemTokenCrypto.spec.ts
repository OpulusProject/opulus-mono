import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { createItemTokenCipher, isEncryptedItemToken } from "@opulus/core";

/**
 * Item access-token crypto (opulus-core/src/utils/itemTokenCrypto.ts).
 *
 * The HTTP suites cannot see how a token is stored, so the format and the
 * failure modes are pinned here. Keys are random per test, never real ones.
 */
const newKey = () => randomBytes(32).toString("base64");
const TOKEN = "access-sandbox-0a1b2c3d-test-token";

test.describe("item token crypto", () => {
  test("round-trips a token through the versioned enc:v1 format", () => {
    const cipher = createItemTokenCipher(newKey());

    const stored = cipher.encrypt(TOKEN);

    expect(stored).toMatch(/^enc:v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(stored).not.toContain(TOKEN);
    expect(isEncryptedItemToken(stored)).toBe(true);
    expect(cipher.decrypt(stored)).toBe(TOKEN);
  });

  test("uses a fresh nonce each time, so equal tokens differ at rest", () => {
    const cipher = createItemTokenCipher(newKey());

    const first = cipher.encrypt(TOKEN);
    const second = cipher.encrypt(TOKEN);

    expect(first).not.toBe(second);
    expect(cipher.decrypt(first)).toBe(TOKEN);
    expect(cipher.decrypt(second)).toBe(TOKEN);
  });

  test("reads a legacy plaintext token as-is", () => {
    const cipher = createItemTokenCipher(newKey());

    expect(isEncryptedItemToken(TOKEN)).toBe(false);
    expect(cipher.decrypt(TOKEN)).toBe(TOKEN);
  });

  test("refuses to encrypt a value that is already encrypted", () => {
    const cipher = createItemTokenCipher(newKey());
    const stored = cipher.encrypt(TOKEN);

    expect(() => cipher.encrypt(stored)).toThrow(/already encrypted/);
  });

  test("fails to decrypt with a different key", () => {
    const stored = createItemTokenCipher(newKey()).encrypt(TOKEN);
    const other = createItemTokenCipher(newKey());

    expect(() => other.decrypt(stored)).toThrow(
      "Failed to decrypt item access token",
    );
  });

  test("fails to decrypt a tampered ciphertext", () => {
    const cipher = createItemTokenCipher(newKey());
    const [prefix, version, nonce, sealed] = cipher.encrypt(TOKEN).split(":");
    const bytes = Buffer.from(sealed, "base64");
    bytes[0] ^= 0xff;
    const tampered = [prefix, version, nonce, bytes.toString("base64")].join(
      ":",
    );

    expect(() => cipher.decrypt(tampered)).toThrow(
      "Failed to decrypt item access token",
    );
  });

  test("fails on an unknown version or a malformed value", () => {
    const cipher = createItemTokenCipher(newKey());

    for (const bad of ["enc:v2:AAAA:BBBB", "enc:v1:", "enc:v1:AAAA", "enc:"]) {
      expect(() => cipher.decrypt(bad)).toThrow(
        "Failed to decrypt item access token",
      );
    }
  });

  test("rejects a missing or wrong-size key", () => {
    expect(() => createItemTokenCipher("")).toThrow(
      /ITEM_TOKEN_ENCRYPTION_KEY is not set/,
    );
    expect(() =>
      createItemTokenCipher(randomBytes(16).toString("base64")),
    ).toThrow(/must be 32 bytes/);
    expect(() => createItemTokenCipher("not base64 !!")).toThrow(
      /must be 32 bytes/,
    );
  });

  test("never puts the key in the error for a bad key", () => {
    const badKey = randomBytes(16).toString("base64");

    expect(() => createItemTokenCipher(badKey)).toThrow();
    try {
      createItemTokenCipher(badKey);
    } catch (error) {
      expect(String(error)).not.toContain(badKey);
    }
  });
});
