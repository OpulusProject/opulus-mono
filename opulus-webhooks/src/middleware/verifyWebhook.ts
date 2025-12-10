import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { config, UnauthorizedError } from "@opulus/core";

/**
 * Middleware to verify Plaid webhook signature
 * Validates that the webhook request is authentic using Plaid's signature verification
 */
export function verifyWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const signature = req.headers["plaid-verification"] as string;

    if (!signature) {
      throw new UnauthorizedError("Missing webhook signature");
    }

    // Get the raw body for signature verification
    const rawBody = JSON.stringify(req.body);
    const secret = config.plaidSecret;

    if (!secret) {
      throw new UnauthorizedError("Plaid secret not configured");
    }

    // Verify signature using HMAC SHA256
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSignature) {
      throw new UnauthorizedError("Invalid webhook signature");
    }

    // Signature verified, proceed to handler
    next();
  } catch (error) {
    next(error);
  }
}


