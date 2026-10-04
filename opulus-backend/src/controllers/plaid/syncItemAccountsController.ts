import { getSession } from "@/services/session/getSession.js";
import {
  itemService,
  syncItemAccountsFromPlaid,
  UnauthorizedError,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Reconcile a persisted Item's bank accounts with Plaid's current view.
 * Called by the frontend after a Link update-mode "add accounts" session
 * completes (Plaid does not fire a webhook for that flow).
 *
 * POST /api/plaid/items/:id/sync-accounts
 */
export async function syncItemAccountsController(
  req: Request,
  res: Response,
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

    const result = await syncItemAccountsFromPlaid(itemId);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}
