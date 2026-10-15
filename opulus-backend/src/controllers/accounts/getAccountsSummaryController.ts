import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedQuery } from "@/middleware/validation.js";
import { getAccountsSummary } from "@/services/accounts/getAccountsSummary.js";
import { AccountsSummaryResponse } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { getAccountsQuerySchema } from "./getAccountsController.js";

/** Takes the same filter as the list, so the totals match what it shows. */
export const getAccountsSummaryQuerySchema = getAccountsQuerySchema;

/**
 * What the authenticated user's accounts add up to, by currency and by type
 * GET /api/accounts/summary?type=credit&type=loan
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getAccountsSummaryController(
  req: Request,
  res: Response<AccountsSummaryResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);

    const { type } =
      getValidatedQuery<typeof getAccountsSummaryQuerySchema>(req);

    const data = await getAccountsSummary({
      userId: session.user.id,
      types: type,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}
