import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedQuery } from "@/middleware/validation.js";
import { getHoldings } from "@/services/investments/getHoldings.js";
import { HoldingsResponse } from "@opulus/core";
import { Request, Response } from "express";
import { z } from "zod";

/** Query parameters for the holdings endpoint. */
export const getHoldingsQuerySchema = z.object({
  /** Only this account's holdings (our account id). */
  accountId: z.string().min(1).optional(),
  /** Only accounts of this subtype (tfsa, rrsp, ...). */
  accountSubtype: z.string().min(1).optional(),
  /** Only holdings of this security (our security id). */
  securityId: z.string().min(1).optional(),
  /** Largest first (the default), or account by account. */
  sort: z.enum(["value", "account"]).optional(),
});

/**
 * Get the authenticated user's investment holdings
 * GET /api/investments/holdings?accountId=acct_1&accountSubtype=tfsa&securityId=sec_1&sort=account
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getHoldingsController(
  req: Request,
  res: Response<HoldingsResponse>
) {
  const session = getRequestSession(res);
  const { accountId, accountSubtype, securityId, sort } =
    getValidatedQuery<typeof getHoldingsQuerySchema>(req);

  const data = await getHoldings({
    userId: session.user.id,
    accountId,
    accountSubtype,
    securityId,
    sort,
  });

  res.status(200).json({ data });
}
