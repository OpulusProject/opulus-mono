import { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../client/prisma.js";
import { AppError } from "../utils/errors.js";

export interface CreateLinkEventData {
  userId: string;
  /** The login session the event was reported in. */
  sessionId?: string;
  eventName: string;
  mode: string;
  itemId?: string;
  plaidLinkSessionId?: string;
  plaidRequestId?: string;
  institutionId?: string;
  institutionName?: string;
  viewName?: string;
  exitStatus?: string;
  errorType?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Repository for Plaid Link events
 * Handles storing the events the browser reports from Link
 */
class LinkEventRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Store a Link event
   * @param data - The event and the user and session it belongs to
   * @returns The stored event
   * @throws AppError if database error occurs
   */
  async create(data: CreateLinkEventData) {
    try {
      return await this.prisma.linkEvent.create({ data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to create link event: ${error.message}`
          : "An unexpected error occurred while creating a link event";
      throw new AppError(message, 500);
    }
  }
}

// Export singleton instance
export const linkEventRepository = new LinkEventRepository(prisma);
