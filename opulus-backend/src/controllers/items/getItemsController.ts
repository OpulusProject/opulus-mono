import { getSession } from "@/services/session/getSession.js";
import { itemService, UnauthorizedError } from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Public DTO for Item response
 * Only includes fields safe to expose to the client
 */
export interface ItemPublicDTO {
  id: string;
  institutionName: string | null;
  institutionLogo: string | null;
  institutionColor: string | null;
  error: string | null;
  metadata: {
    accountCount: number;
    totalAvailableBalance: number;
  };
}

/**
 * Transform full item data to public DTO
 * Filters out sensitive fields like accessToken, plaidItemId, etc.
 */
function toItemPublicDTO(item: {
  id: string;
  institutionName: string | null;
  institutionLogo: string | null;
  institutionColor: string | null;
  error: string | null;
  metadata: {
    accountCount: number;
    totalAvailableBalance: number;
  };
}): ItemPublicDTO {
  return {
    id: item.id,
    institutionName: item.institutionName,
    institutionLogo: item.institutionLogo,
    institutionColor: item.institutionColor,
    error: item.error,
    metadata: item.metadata,
  };
}

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

    // Get all items with metadata (service returns full data)
    const items = await itemService.getAllByUserId(userId);

    // Transform to public DTO, filtering sensitive fields
    const publicItems: ItemPublicDTO[] = items.map(toItemPublicDTO);

    res.status(200).json({
      data: {
        items: publicItems,
      },
    });
  } catch (error) {
    next(error);
  }
}
