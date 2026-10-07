import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedBody } from "@/middleware/validation.js";
import { createUpdateLinkToken } from "@/services/linkTokens/createUpdateLinkToken.js";
import { LinkTokenResponse } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

export const updateLinkTokenBodySchema = z.object({
  itemId: z.string().min(1, "itemId is required"),
  // "reconnect" repairs the item; "add-accounts" also lets the user share
  // accounts that appeared since it was linked.
  mode: z.enum(["reconnect", "add-accounts"]).default("reconnect"),
});

/**
 * Create a Plaid Link token in update mode for an item the user owns.
 * POST /api/link-tokens/update
 */
export async function createUpdateLinkTokenController(
  req: Request,
  res: Response<LinkTokenResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);

    const { itemId, mode } =
      getValidatedBody<typeof updateLinkTokenBodySchema>(req);

    const { linkToken } = await createUpdateLinkToken({
      userId: session.user.id,
      itemId,
      mode,
    });

    res.status(200).json({ data: { linkToken } });
  } catch (error) {
    next(error);
  }
}
