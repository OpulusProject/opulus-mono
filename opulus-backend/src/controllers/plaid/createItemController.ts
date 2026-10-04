import { getSession } from "@/services/session/getSession.js";
import { createItem } from "@/services/plaid/createItem.js";
import { UnauthorizedError } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

export const createItemBodySchema = z.object({
  publicToken: z.string().min(1, "publicToken is required"),
  // Subset of Plaid's Link onSuccess metadata used for duplicate detection
  // (per https://plaid.com/docs/link/duplicate-items/).
  institutionId: z.string().nullable(),
  accounts: z.array(
    z.object({
      name: z.string(),
      mask: z.string().nullable(),
    })
  ),
});

/**
 * Create a new Plaid Item from the public_token returned by Link.
 * Short-circuits with 409 if the Link metadata matches an Item the user has
 * already linked (per Plaid's duplicate-items guidance).
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

    const { publicToken, institutionId, accounts } =
      createItemBodySchema.parse(req.body);

    const result = await createItem(session.user.id, publicToken, {
      institutionId,
      accounts,
    });

    if (result.duplicate) {
      res.status(409).json({
        data: { itemId: result.existingItemId, duplicate: true },
        message: "This institution is already linked to your account.",
      });
      return;
    }

    res.status(201).json({ data: { itemId: result.item.id, duplicate: false } });
  } catch (error) {
    next(error);
  }
}
