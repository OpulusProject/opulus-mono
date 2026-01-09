import { config, plaid } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { importJWK, jwtVerify } from "jose";
import { sha256 } from "js-sha256";
import { jwtDecode } from "jwt-decode";
import { JWKPublicKey } from "plaid";
import safeCompare from "safe-compare";

const KEY_CACHE = new Map<string, JWKPublicKey>();

export async function verifyPlaidWebhook(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const signedJwt = req.headers["plaid-verification"] as string;

  // Check if header exists before trying to decode
  if (!signedJwt) {
    res.status(401).json({
      message: "Webhook verification failed: Missing plaid-verification header",
    });
    return;
  }

  let decodedToken;
  try {
    decodedToken = jwtDecode(signedJwt);
  } catch (error) {
    res.status(401).json({
      message: "Webhook verification failed: Invalid JWT format",
    });
    return;
  }

  // Extract the JWT header
  let decodedTokenHeader;
  try {
    decodedTokenHeader = jwtDecode(signedJwt, { header: true });
  } catch (error) {
    res.status(401).json({
      message: "Webhook verification failed: Invalid JWT header format",
    });
    return;
  }

  // Reject webhook if alg is not ES256
  if (decodedTokenHeader.alg !== "ES256") {
    res
      .status(401)
      .json({ message: "Webhook verification failed: Invalid alg" });
    return;
  }

  // Extract the kid value from the header
  const currentKeyID = decodedTokenHeader.kid ?? "";

  // Verify Plaid credentials are configured
  if (!config.plaidClientId || !config.plaidSecret) {
    res.status(500).json({
      message: "Webhook verification failed: Plaid credentials not configured",
    });
    return;
  }

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
        const response = await plaid.webhookVerificationKeyGet({
          key_id: keyID,
        });

        const key = response.data.key;
        KEY_CACHE.set(keyID, key);
      } catch (err: any) {
        // Check if it's an invalid key_id error (environment mismatch)
        if (err?.response?.data?.error_code === 'INVALID_WEBHOOK_VERIFICATION_KEY_ID') {
          console.error(
            `[WEBHOOK VERIFICATION] Invalid key_id: ${keyID}. ` +
            `This usually means the webhook is from a different Plaid environment than configured. ` +
            `Current PLAID_ENV: ${config.plaidEnv}. ` +
            `Error: ${err.response.data.error_message}`
          );
          res.status(401).json({
            message: "Webhook verification failed: Invalid key ID (environment mismatch)",
            details: err.response.data.error_message,
          });
          return;
        }
        
        // For other errors, log and return generic error
        console.error("Error fetching webhook verification key:", err);
        res.status(500).json({
          message: "Internal server error",
          details: err?.response?.data?.error_message || err?.message || "Unknown error",
        });
        return;
      }
    }
  }

  // If the key ID is not in the cache, the key ID may be invalid.
  if (!KEY_CACHE.has(currentKeyID)) {
    res
      .status(401)
      .json({ message: "Webhook verification failed: Invalid key ID" });
    return;
  }

  // Fetch the current key from the cache.
  const key = KEY_CACHE.get(currentKeyID);

  // Reject expired keys.
  if (!key || key.expired_at != null) {
    res
      .status(401)
      .json({ message: "Webhook verification failed: Expired key" });
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
    res
      .status(401)
      .json({ message: "Webhook verification failed: Invalid signature" });
    return;
  }

  // Compare hashes.
  const bodyString = JSON.stringify(req.body, null, 2);
  const bodyHash = sha256(bodyString);
  const claimedBodyHash = (decodedToken as { request_body_sha256: string })
    .request_body_sha256;

  if (!safeCompare(bodyHash, claimedBodyHash)) {
    res
      .status(401)
      .json({ message: "Webhook verification failed: Invalid body hash" });
    return;
  }

  next();
}
