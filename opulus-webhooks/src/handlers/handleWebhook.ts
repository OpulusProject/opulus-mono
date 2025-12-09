import { NextFunction, Request, Response } from "express";
import type { PlaidWebhookEvent } from "../types/plaid/webhook.js";
import { processPlaidWebhook } from "./webhookHandlers.js";

/**
 * Handler for processing webhook events
 * Routes webhook events to appropriate handlers
 */
export async function handleWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const event = req.body as PlaidWebhookEvent;

    // Process the webhook event
    await processPlaidWebhook(event);

    // Acknowledge receipt of the webhook
    res.status(200).json({
      status: "success",
      message: "Webhook processed successfully",
    });
  } catch (error) {
    next(error);
  }
}

