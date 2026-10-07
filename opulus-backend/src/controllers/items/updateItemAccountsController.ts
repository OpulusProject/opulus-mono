import { getSession } from "@/services/session/getSession.js";
import { updateItemAccounts } from "@/services/items/updateItemAccounts.js";
import {
  itemService,
  UnauthorizedError,
  UpdateItemAccountsResponse,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Reconcile a persisted Item's accounts with Plaid's current view.
 * Called by the frontend after a Link update-mode session completes (Plaid
 * does not fire a webhook for that flow).
 *
 * POST /api/items/:id/update-accounts
 */
export async function updateItemAccountsController(
  req: Request,
  res: Response<UpdateItemAccountsResponse>,
  next: NextFunction
) {
  try {
    const session = await getSession(req.headers);
    if (!session?.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const itemId = req.params.id;
    const item = await itemService.getById(itemId);
    if (item.userId !== session.user.id) {
      throw new UnauthorizedError("You do not have access to this item");
    }

    const result = await updateItemAccounts(itemId);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}
