import { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../client/prisma.js";
import { AppError, NotFoundError } from "../utils/errors.js";

export interface UpdateUserData {
  id: string;
  plaidId?: string;
  plaidUserToken?: string;
  name?: string;
  email?: string;
  image?: string;
}

/**
 * Service for managing users
 * Handles user retrieval and updates
 */
class UserService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get a user by ID
   * @param userId - User ID
   * @returns User if found
   * @throws NotFoundError if user not found
   * @throws AppError if database error occurs
   */
  async get(userId: string) {
    try {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });

      return user;
    } catch (error) {
      // Handle Prisma not found error (P2025)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundError("User not found");
      }

      // Handle other Prisma errors (connection issues, etc.)
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      // Handle unknown errors
      const message =
        error instanceof Error
          ? `Failed to get user: ${error.message}`
          : "An unexpected error occurred while fetching user";
      throw new AppError(message, 500);
    }
  }

  /**
   * Update a user's non-sensitive fields
   * For password updates, use updatePassword service (to be created)
   * For email updates, consider using updateEmail service (if email verification required)
   *
   * @param data - User update data
   * @returns Updated user
   * @throws NotFoundError if user not found
   * @throws AppError if database error occurs
   */
  async update(data: UpdateUserData) {
    const { id, ...updateData } = data;

    try {
      return await this.prisma.user.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      // Handle Prisma not found error (P2025)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundError("User not found");
      }

      // Handle other Prisma errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      // Handle unknown errors
      const message =
        error instanceof Error
          ? `Failed to update user: ${error.message}`
          : "An unexpected error occurred while updating user";
      throw new AppError(message, 500);
    }
  }
}

// Export singleton instance
export const userService = new UserService(prisma);

