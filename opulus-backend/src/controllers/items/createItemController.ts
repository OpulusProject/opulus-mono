import { getRequestSession } from "@/middleware/session/requireSession.js";
import { createItem } from "@/services/items/createItem.js";
import {
  CreateItemRequestSchema,
  CreateItemResponse,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";

export const createItemBodySchema = CreateItemRequestSchema;

/**
 * POST /api/items
 */
export async function createItemController(
  req: Request,
  res: Response<CreateItemResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);

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
