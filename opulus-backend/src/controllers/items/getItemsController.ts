import { getSession } from "@/services/session/getSession.js";
import {
  ItemPublicDTO,
  itemService,
  toItemPublicDTO,
  UnauthorizedError,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Get all items for the authenticated user with metadata
 * GET /api/items
 */
export async function getItemsController(
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

    const userId = session.user.id;

    // Get all items with bank accounts (service returns full data)
    const items = await itemService.getAllByUserId(userId);

    // Transform to public DTO, filtering sensitive fields
    const publicItems: ItemPublicDTO[] = items.map((item) =>
      toItemPublicDTO({
        id: item.id,
        institutionName: item.institutionName,
        institutionLogo: item.institutionLogo,
        institutionColor: item.institutionColor,
        error: item.error,
        bankAccounts: item.bankAccounts,
      })
    );

    res.status(200).json({
      data: {
        items: publicItems,
      },
    });
  } catch (error) {
    next(error);
  }
}
