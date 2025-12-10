import { plaidClient } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { importJWK, jwtVerify } from "jose";
import { sha256 } from "js-sha256";
import { jwtDecode } from "jwt-decode";
import safeCompare from "safe-compare";

// JWKPublicKey type from Plaid
interface JWKPublicKey {
  alg: string;
  crv: string;
  kid: string;
  kty: string;
  use: string;
  x: string;
  y: string;
  expired_at: number | null;
}

const KEY_CACHE = new Map<string, JWKPublicKey>();

/**
 * Middleware to verify Plaid webhook signature using JWT verification
 * Validates that the webhook request is authentic using Plaid's JWT-based signature verification
 */
export async function verifyPlaidWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const signedJwt = req.headers["plaid-verification"] as string;

    if (!signedJwt) {
      res.status(401).json({
        message: "Webhook verification failed: Missing verification header",
      });
      return;
    }

    const decodedToken = jwtDecode(signedJwt);
    const decodedTokenHeader = jwtDecode(signedJwt, { header: true });

    // Reject webhook if alg is not ES256
    if (decodedTokenHeader.alg !== "ES256") {
      res.status(401).json({
        message: "Webhook verification failed: Invalid alg",
      });
      return;
    }

    // Extract the kid value from the header
    const currentKeyID = decodedTokenHeader.kid ?? "";

    // If key not in cache, update the key cache
    if (!KEY_CACHE.has(currentKeyID)) {
      const keyIDsToUpdate: string[] = [];

      KEY_CACHE.forEach((key, keyID) => {
        // We will also want to refresh any not-yet-expired keys
        if (key.expired_at == null) {
          keyIDsToUpdate.push(keyID);
        }
      });

      keyIDsToUpdate.push(currentKeyID);

      for (const keyID of keyIDsToUpdate) {
        try {
          const response = await plaidClient.webhookVerificationKeyGet({
            key_id: keyID,
          });
          const key = response.data.key;
          KEY_CACHE.set(keyID, key);
        } catch (err) {
          console.error("Error fetching webhook verification key:", err);
          res.status(500).json({ message: "Internal server error" });
          return;
        }
      }
    }

    // If the key ID is not in the cache, the key ID may be invalid.
    if (!KEY_CACHE.has(currentKeyID)) {
      res.status(401).json({
        message: "Webhook verification failed: Invalid key ID",
      });
      return;
    }

    // Fetch the current key from the cache.
    const key = KEY_CACHE.get(currentKeyID);

    // Reject expired keys.
    if (!key || key.expired_at != null) {
      res.status(401).json({
        message: "Webhook verification failed: Expired key",
      });
      return;
    }

    // Validate the signature and iat
    try {
      const keyLike = await importJWK(key);
      // This will throw an error if verification fails
      await jwtVerify(signedJwt, keyLike, {
        maxTokenAge: "5 min",
      });
    } catch (error) {
      console.error("Webhook verification failed: Invalid signature", error);
      res.status(401).json({
        message: "Webhook verification failed: Invalid signature",
      });
      return;
    }

    // Compare hashes using the original raw body string
    // This ensures we're comparing against the exact bytes Plaid sent
    const rawBodyString = (req as any).rawBody;
    if (!rawBodyString) {
      res.status(401).json({
        message: "Webhook verification failed: Missing raw body",
      });
      return;
    }

    const bodyHash = sha256(rawBodyString);
    const claimedBodyHash = (decodedToken as { request_body_sha256: string })
      .request_body_sha256;

    if (!safeCompare(bodyHash, claimedBodyHash)) {
      res.status(401).json({
        message: "Webhook verification failed: Invalid body hash",
      });
      return;
    }

    // Signature verified, proceed to handler
    next();
  } catch (error) {
    console.error("Webhook verification error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
