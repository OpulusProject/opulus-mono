import { getSession } from "@/services/session/getSession.js";
import {
  itemService,
  ItemsResponse,
  toItemDTO,
  UnauthorizedError,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Get all items for the authenticated user with metadata
 * GET /api/items
 */
export async function getItemsController(
  req: Request,
  res: Response<ItemsResponse>,
  next: NextFunction
) {
  try {
    // Get authenticated user session
    const session = await getSession(req.headers);
    if (!session?.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const userId = session.user.id;

    // Get all items with bank accounts (service returns full data)
    const items = await itemService.getAllByUserId(userId);

    // Transform to the public shape, leaving out sensitive fields
    res.status(200).json({ data: { items: items.map(toItemDTO) } });
  } catch (error) {
    next(error);
  }
}
