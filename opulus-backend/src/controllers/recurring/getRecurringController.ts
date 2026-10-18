import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedQuery } from "@/middleware/validation.js";
import { getRecurring } from "@/services/recurring/getRecurring.js";
import { RecurringDirectionSchema, RecurringResponse } from "@opulus/core";
import { Request, Response } from "express";
import { z } from "zod";

/** Query parameters for the recurring transactions endpoint. */
export const getRecurringQuerySchema = z.object({
  direction: RecurringDirectionSchema.optional(),
  /** "true" to include streams that have stopped. */
  includeInactive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

/**
 * Get the authenticated user's recurring payments and income
 * GET /api/recurring-transactions?direction=outflow&includeInactive=true
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getRecurringController(
  req: Request,
  res: Response<RecurringResponse>
) {
  const session = getRequestSession(res);
  const { direction, includeInactive } =
    getValidatedQuery<typeof getRecurringQuerySchema>(req);

  const data = await getRecurring({
    userId: session.user.id,
    direction,
    includeInactive,
  });

  res.status(200).json({ data });
}
