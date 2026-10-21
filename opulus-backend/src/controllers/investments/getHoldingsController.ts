import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedQuery } from "@/middleware/validation.js";
import { getHoldings } from "@/services/investments/getHoldings.js";
import { HoldingsResponse } from "@opulus/core";
import { Request, Response } from "express";
import { z } from "zod";

/** A value given once or repeated (?accountId=a&accountId=b), as a list. */
const asList = (value: unknown) =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

/** Query parameters for the holdings endpoint. */
export const getHoldingsQuerySchema = z.object({
  /** Only these accounts' holdings (our account ids), given once or repeated. */
  accountId: z.preprocess(asList, z.array(z.string().min(1)).optional()),
  /** Only holdings of this security (our security id). */
  securityId: z.string().min(1).optional(),
});

/**
 * Get the authenticated user's investment holdings
 * GET /api/investments/holdings?accountId=acct_1&accountId=acct_2&securityId=sec_1
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getHoldingsController(
  req: Request,
  res: Response<HoldingsResponse>
) {
  const session = getRequestSession(res);
  const { accountId: accountIds, securityId } =
    getValidatedQuery<typeof getHoldingsQuerySchema>(req);

  const data = await getHoldings({
    userId: session.user.id,
    accountIds,
    securityId,
  });

  res.status(200).json({ data });
}
