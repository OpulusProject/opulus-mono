import { logger } from "@opulus/core";
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
  const requestId = (req as Request & { id?: string }).id || "unknown";

  try {
    // Body is already parsed by verification middleware
    const event = req.body as PlaidWebhookEvent;

    // Log webhook received
    logger.info(
      {
        webhook_type: event.webhook_type,
        webhook_code: event.webhook_code,
        item_id: event.item_id,
        request_id: requestId,
      },
      "Webhook received"
    );

    // Acknowledge immediately (Plaid requires fast response)
    res.status(200).json({ received: true });

    // Enqueue for async processing with retry support
    // Uses defaultJobOptions from queue configuration (no need to duplicate)
    const job = await webhookQueue.add(
      `process-${event.webhook_type.toLowerCase()}`,
      event
    );

    // Log webhook enqueued
    logger.info(
      {
        webhook_type: event.webhook_type,
        webhook_code: event.webhook_code,
        job_id: job.id,
        request_id: requestId,
      },
      "Webhook enqueued"
    );
  } catch (error) {
    // If acknowledgment hasn't been sent yet, send error response
    if (!res.headersSent) {
      logger.error(
        {
          request_id: requestId,
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          error_message: error instanceof Error ? error.message : String(error),
        },
        "Error before webhook acknowledgment"
      );
      next(error);
    } else {
      // Already acknowledged, log error
      logger.error(
        {
          request_id: requestId,
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          error_message: error instanceof Error ? error.message : String(error),
        },
        "Error enqueueing webhook"
      );
    }
  }
}

// This function is no longer needed - processing is handled by queue workers
// Keeping for backwards compatibility if needed
