import { getSession } from "@/services/session/getSession.js";
import {
  itemService,
  plaidService,
  UnauthorizedError,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

export const updateLinkTokenBodySchema = z.object({
  itemId: z.string().min(1, "itemId is required"),
});

/**
 * Create a Plaid Link token in update mode for an item the user owns.
 * POST /api/plaid/link-token/update
 */
export async function createUpdateLinkTokenController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const session = await getSession(req.headers);
    if (!session?.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const { itemId } = updateLinkTokenBodySchema.parse(req.body);
    const item = await itemService.getById(itemId);

    if (item.userId !== session.user.id) {
      throw new UnauthorizedError("You do not have access to this item");
    }

    const linkTokenResponse = await plaidService.createUpdateLinkToken(
      item.accessToken,
      session.user.id
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
