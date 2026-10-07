import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedBody } from "@/middleware/validation.js";
import {
  itemService,
  plaidService,
  LinkTokenResponse,
  UnauthorizedError,
} from "@opulus/core";
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
    const item = await itemService.getById(itemId);

    if (item.userId !== session.user.id) {
      throw new UnauthorizedError("You do not have access to this item");
    }

    const linkTokenResponse = await plaidService.createUpdateLinkToken(
      item.accessToken,
      session.user.id,
      { selectAccounts: mode === "add-accounts" }
    );

    res.status(200).json({
      data: {
        linkToken: linkTokenResponse.link_token,
      },
    });
  } catch (error) {
    next(error);
  }
}
