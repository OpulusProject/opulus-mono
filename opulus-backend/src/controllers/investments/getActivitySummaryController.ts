import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedQuery } from "@/middleware/validation.js";
import { getActivitySummary } from "@/services/investments/getActivitySummary.js";
import { ActivitySummaryResponse } from "@opulus/core";
import { Request, Response } from "express";
import { z } from "zod";

/** Query parameters for the activity summary endpoint. */
export const getActivitySummaryQuerySchema = z.object({
  /** Only this account (our account id). */
  accountId: z.string().min(1).optional(),
});

/**
 * Get what the authenticated user's investment accounts paid, charged and took in
 * GET /api/investments/activity/summary?accountId=acct_1
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getActivitySummaryController(
  req: Request,
  res: Response<ActivitySummaryResponse>
) {
  const session = getRequestSession(res);
  const { accountId } =
    getValidatedQuery<typeof getActivitySummaryQuerySchema>(req);

  const data = await getActivitySummary({
    userId: session.user.id,
    accountId,
  });

  res.status(200).json({ data });
}
