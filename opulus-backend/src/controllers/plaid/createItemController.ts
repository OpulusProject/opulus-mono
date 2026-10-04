import { getSession } from "@/services/session/getSession.js";
import { createItemFromPublicToken, UnauthorizedError } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

export const createItemBodySchema = z.object({
  publicToken: z.string().min(1, "publicToken is required"),
});

/**
 * Exchange a Plaid Link public_token (from the Link onSuccess callback) for
 * an access token, and persist the Item + its initial accounts. Idempotent
 * on the Plaid item_id, so safe to retry if the frontend network call fails.
 *
 * POST /api/plaid/items
 */
export async function createItemController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const session = await getSession(req.headers);
    if (!session?.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const { publicToken } = createItemBodySchema.parse(req.body);
    const item = await createItemFromPublicToken(session.user.id, publicToken);

    res.status(201).json({ data: { itemId: item.id } });
  } catch (error) {
    next(error);
  }
}
