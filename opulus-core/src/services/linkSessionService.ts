import { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../client/prisma.js";
import { AppError, ConflictError, NotFoundError } from "../utils/errors.js";

export interface CreateLinkSessionData {
  userId: string;
  linkToken: string;
}

/**
 * Service for managing link sessions
 * Handles creation and retrieval of Plaid link sessions
 */
class LinkSessionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a link session in the database
   * @param data - Link session data
   * @returns Created link session
   * @throws ConflictError if link token already exists
   * @throws AppError if database error occurs
   */
  async create(data: CreateLinkSessionData) {
    try {
      return await this.prisma.linkSession.create({
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Handle unique constraint violation
        if (error.code === "P2002") {
          throw new ConflictError("Link token already exists");
        }
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      // Handle unknown errors
      const message =
        error instanceof Error
          ? `Failed to create link session: ${error.message}`
          : "An unexpected error occurred while creating link session";
      throw new AppError(message, 500);
    }
  }

  /**
   * Get a link session by link token
   * @param linkToken - The Plaid link token
   * @returns Link session with userId
   * @throws NotFoundError if link session not found
   * @throws AppError if database error occurs
   */
  async getByToken(linkToken: string) {
    try {
      const linkSession = await this.prisma.linkSession.findUnique({
        where: { linkToken },
        select: {
          id: true,
          userId: true,
          linkToken: true,
          createdAt: true,
        },
      });

      if (!linkSession) {
        throw new NotFoundError("Link session not found");
      }

      return linkSession;
    } catch (error) {
      // Re-throw NotFoundError
      if (error instanceof NotFoundError) {
        throw error;
      }

      // Handle Prisma errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      // Handle unknown errors
      const message =
        error instanceof Error
          ? `Failed to get link session: ${error.message}`
          : "An unexpected error occurred while fetching link session";
      throw new AppError(message, 500);
    }
  }
}

// Export singleton instance
export const linkSessionService = new LinkSessionService(prisma);

