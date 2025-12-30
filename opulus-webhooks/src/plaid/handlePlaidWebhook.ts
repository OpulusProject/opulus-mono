import { AppError } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import type { PlaidWebhookEvent } from "../types/plaid/webhookSchema.js";
import { handleItemWebhook } from "./handlers/item/index.js";
import { handleLinkWebhook } from "./handlers/link/index.js";
import { handleTransactionsWebhook } from "./handlers/transactions/index.js";
import { unhandledWebhook } from "./handlers/unhandledPlaidWebhook.js";

/**
 * Handler for processing webhook events
 * Acknowledges immediately and processes asynchronously
 */
export async function handlePlaidWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const event = req.body as PlaidWebhookEvent;

    // Acknowledge immediately
    res.status(200).json({ received: true });

    // Process asynchronously (don't await - fire and forget)
    processPlaidWebhook(event);
  } catch (error) {
    // If acknowledgment hasn't been sent yet, send error response
    if (!res.headersSent) {
      next(error);
    } else {
      // Already acknowledged, log error
      console.error("Error handling webhook:", error);
    }
  }
}

/**
 * Process a Plaid webhook event
 * Routes webhook events to appropriate handlers based on type and code
 * @param event - Plaid webhook event
 * @throws AppError if processing fails
 */
export async function processPlaidWebhook(
  event: PlaidWebhookEvent
): Promise<void> {
  try {
    const { webhook_type, webhook_code } = event;

    // Route to appropriate handler based on webhook type and code
    switch (webhook_type) {
      case "ITEM":
        await handleItemWebhook(webhook_code, event);
        break;
      case "LINK":
        await handleLinkWebhook(webhook_code, event);
        break;
      case "TRANSACTIONS":
        await handleTransactionsWebhook(webhook_code, event);
        break;
      default:
        unhandledWebhook(webhook_type, webhook_code, event);
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? `Failed to process webhook: ${error.message}`
        : "An unexpected error occurred while processing webhook";
    throw new AppError(message, 500);
  }
}
