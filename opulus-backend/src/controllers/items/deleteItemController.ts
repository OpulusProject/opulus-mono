import { getSession } from "@/services/session/getSession.js";
import {
  accountService,
  itemService,
  plaidService,
  prisma,
  transactionService,
  UnauthorizedError,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Deletes a specified item for the authenticated user with metadata
 * DELETE /api/items/:id
 */
export async function deleteItemController(
  req: Request,
  res: Response<void>,
  next: NextFunction
) {
  try {
    // Get authenticated user session
    const session = await getSession(req.headers);
    if (!session?.user) {
      throw new UnauthorizedError("Authentication required");
    }

    // Permission check
    const itemId = req.params.id;
    const item = await itemService.getById(itemId);
    if (item.userId !== session.user.id) {
      throw new UnauthorizedError("You do not have access to this item");
    }

    // Disconnect the item from Plaid
    await plaidService.removeItem(item.accessToken);

    // Delete the item and everything linked to it atomically
    await prisma.$transaction(async (tx) => {
      await transactionService.deleteByItemId(itemId, tx);
      await accountService.deleteByItemId(itemId, tx);
      await itemService.delete(itemId, tx);
    });

    // TODO: record deletion of item

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
