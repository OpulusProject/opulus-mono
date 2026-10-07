import { getRequestSession } from "@/middleware/session/requireSession.js";
import { deleteItem } from "@/services/items/deleteItem.js";
import { NextFunction, Request, Response } from "express";

/**
 * Disconnects a specified item for the authenticated user, deleting everything
 * linked to it
 * DELETE /api/items/:id
 */
export async function deleteItemController(
  req: Request,
  res: Response<void>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);

    await deleteItem({ userId: session.user.id, itemId: req.params.id });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
