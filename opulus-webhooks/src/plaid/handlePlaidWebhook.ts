import { NextFunction, Request, Response } from "express";
import { webhookQueue } from "../queue/webhookQueue.js";
import type { PlaidWebhookEvent } from "../types/plaid/webhookSchema.js";

/**
 * Handler for processing webhook events
 * Acknowledges immediately and enqueues for async processing
 */
export async function handlePlaidWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Body is already parsed by verification middleware
    const event = req.body as PlaidWebhookEvent;

    console.log(
      `[WEBHOOK] Received ${event.webhook_type}:${event.webhook_code}`
    );

    // Acknowledge immediately (Plaid requires fast response)
    res.status(200).json({ received: true });

    // Enqueue for async processing with retry support
    // Uses defaultJobOptions from queue configuration (no need to duplicate)
    await webhookQueue.add(
      `process-${event.webhook_type.toLowerCase()}`,
      event
    );

    console.log(
      `[WEBHOOK] Enqueued ${event.webhook_type}:${event.webhook_code} for processing`
    );
  } catch (error) {
    // If acknowledgment hasn't been sent yet, send error response
    if (!res.headersSent) {
      console.error("[WEBHOOK] Error before acknowledgment:", error);
      next(error);
    } else {
      // Already acknowledged, log error
      console.error("[WEBHOOK] Error enqueueing webhook:", error);
    }
  }
}

// This function is no longer needed - processing is handled by queue workers
// Keeping for backwards compatibility if needed
