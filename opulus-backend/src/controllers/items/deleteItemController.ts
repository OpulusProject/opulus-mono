import { getSession } from "@/services/session/getSession.js";
import {
  bankAccountService,
  itemService,
  plaidService,
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
  res: Response,
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
    const removeItemResponse = await plaidService.removeItem(item.accessToken);

    // Delete transactions linked to item
    const deleteTransactionsResponse =
      await transactionService.deleteByItemId(itemId);

    // Delete accounts linked to item
    const deleteAccountsResponse =
      await bankAccountService.deleteByItemId(itemId);

    // Delete item
    const deleteItemResponse =
      await itemService.delete(itemId);

    // TODO: record deletion of item

    res.status(200).json({
    })
  } catch (error) {
    next(error);
  }
}
