import { NextFunction, Request, Response } from "express";
import { ValidationError } from "@opulus/core";
import { WebhookSchema } from "../types/plaid/webhookSchema.js";

/**
 * Middleware to validate webhook request body against schema
 */
export function validateWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const result = WebhookSchema.safeParse({ body: req.body });

    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));

      throw new ValidationError("Webhook validation failed", errors);
    }

    next();
  } catch (error) {
    next(error);
  }
}

