import { getSession } from "@/services/session/getSession.js";
import { getDemoMode } from "@/middleware/demo/demoMode.js";
import {
  ItemPublicDTO,
  getItemService,
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
    // Get authenticated user session (or mock session in demo mode)
    const isDemo = getDemoMode(req);
    const session = await getSession(req.headers, isDemo);
    if (!session?.user && !isDemo) {
      throw new UnauthorizedError("Authentication required");
    }

    const userId = session?.user?.id || "demo-user-id";

    // Get all items with bank accounts (service returns full data)
    // getItemService() returns demo service in demo mode, real service otherwise
    // Pass isDemo flag so service factory can use request-based demo detection
    const itemService = getItemService(isDemo);
    const items = await itemService.getAllByUserId(userId);

    // Transform to public DTO, filtering sensitive fields
    const publicItems: ItemPublicDTO[] = items.map((item: any) =>
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
