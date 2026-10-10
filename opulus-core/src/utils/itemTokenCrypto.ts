import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import config from "../config/default.js";
import { AppError } from "./errors.js";

/**
 * Encryption of Plaid access tokens at rest.
 *
 * A token is stored in `Item.accessToken` as
 *
 *   enc:v1:<base64 nonce>:<base64 ciphertext + auth tag>
 *
 * (AES-256-GCM, a fresh random 12-byte nonce per encryption). The version in
 * the prefix lets the algorithm or the key source (for example a KMS) change
 * later without a schema change: new versions are added next to `v1`, and old
 * values stay readable.
 *
 * A value without the `enc:` prefix is a legacy plaintext token. It is still
 * readable, so a deploy that lands before the backfill does not break, but it
 * is never written.
 *
 * The key comes from ITEM_TOKEN_ENCRYPTION_KEY (32 bytes, base64) and is never
 * stored in the database. Nothing here logs the key or a token.
 */

const PREFIX = "enc:";
const VERSION_V1 = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export interface ItemTokenCipher {
  /** Encrypt a plaintext token into the stored `enc:v1:` format. */
  encrypt(plaintext: string): string;
  /** Read a stored value: decrypt `enc:` values, pass legacy plaintext through. */
  decrypt(stored: string): string;
}

/** True if the stored value is ciphertext rather than a legacy plaintext token. */
export function isEncryptedItemToken(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

/**
 * Parse the key. Throws a message that says what is wrong without echoing the
 * value.
 */
function parseKey(base64Key: string | undefined): Buffer {
  if (!base64Key) {
    throw new Error(
      "ITEM_TOKEN_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32"
    );
  }
  const key = Buffer.from(base64Key, "base64");
  // Buffer.from is lenient with bad base64, so also require a clean round trip.
  if (key.length !== KEY_BYTES || key.toString("base64") !== base64Key) {
    throw new Error(
      `ITEM_TOKEN_ENCRYPTION_KEY must be ${KEY_BYTES} bytes, base64 encoded. Generate one with: openssl rand -base64 32`
    );
  }
  return key;
}

/** Build a cipher for a base64 key. Throws if the key is missing or malformed. */
export function createItemTokenCipher(base64Key: string): ItemTokenCipher {
  const key = parseKey(base64Key);

  return {
    encrypt(plaintext) {
      if (isEncryptedItemToken(plaintext)) {
        // Encrypting twice would make the token unreadable; this is a bug.
        throw new AppError("Item access token is already encrypted", 500);
      }
      const nonce = randomBytes(NONCE_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, nonce);
      const body = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);
      const sealed = Buffer.concat([body, cipher.getAuthTag()]);
      return `${VERSION_V1}${nonce.toString("base64")}:${sealed.toString("base64")}`;
    },

    decrypt(stored) {
      if (!isEncryptedItemToken(stored)) {
        return stored;
      }
      // Error messages never include the stored value.
      const fail = () =>
        new AppError("Failed to decrypt item access token", 500);

      if (!stored.startsWith(VERSION_V1)) {
        throw fail();
      }
      const [nonceB64, sealedB64, ...extra] = stored
        .slice(VERSION_V1.length)
        .split(":");
      if (!nonceB64 || !sealedB64 || extra.length > 0) {
        throw fail();
      }
      const nonce = Buffer.from(nonceB64, "base64");
      const sealed = Buffer.from(sealedB64, "base64");
      if (nonce.length !== NONCE_BYTES || sealed.length < TAG_BYTES) {
        throw fail();
      }
      try {
        const decipher = createDecipheriv(ALGORITHM, key, nonce);
        decipher.setAuthTag(sealed.subarray(sealed.length - TAG_BYTES));
        return Buffer.concat([
          decipher.update(sealed.subarray(0, sealed.length - TAG_BYTES)),
          decipher.final(),
        ]).toString("utf8");
      } catch {
        // Wrong key or tampered value.
        throw fail();
      }
    },
  };
}

let defaultCipher: ItemTokenCipher | undefined;

function getDefaultCipher(): ItemTokenCipher {
  defaultCipher ??= createItemTokenCipher(config.itemTokenEncryptionKey);
  return defaultCipher;
}

/**
 * Check the configured key now, so a service fails at startup instead of on the
 * first item it touches. Call it once at boot (backend, webhooks, scripts).
 * @throws Error if ITEM_TOKEN_ENCRYPTION_KEY is missing or not 32 bytes of base64
 */
export function assertItemTokenEncryptionKey(): void {
  getDefaultCipher();
}

/** Encrypt a plaintext access token with the configured key. */
export function encryptItemToken(plaintext: string): string {
  return getDefaultCipher().encrypt(plaintext);
}

/** Decrypt a stored access token (legacy plaintext passes through). */
export function decryptItemToken(stored: string): string {
  return getDefaultCipher().decrypt(stored);
}
