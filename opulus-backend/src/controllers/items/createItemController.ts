import { getSession } from "@/services/session/getSession.js";
import { createItem } from "@/services/items/createItem.js";
import { UnauthorizedError } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

export const createItemBodySchema = z.object({
  publicToken: z.string().min(1, "publicToken is required"),
  institutionId: z.string().min(1, "institutionId is required"),
});

/**
 * POST /api/items
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

    const { publicToken, institutionId } = createItemBodySchema.parse(req.body);

    const result = await createItem(session.user.id, publicToken, {
      institutionId,
    });

    if (result.duplicate) {
      res.status(409).json({
        data: { itemId: result.existingItemId, duplicate: true },
        message: "You are already connected to this institution.",
      });
      return;
    }

    res
      .status(201)
      .json({ data: { itemId: result.item.id, duplicate: false } });
  } catch (error) {
    next(error);
  }
}
