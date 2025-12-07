import { Prisma } from "@prisma/client";
import prisma from "@/client/prisma.js";
import { NotFoundError, AppError } from "@/utils/errors.js";

/**
 * Get a user by ID
 * @param userId - User ID
 * @returns User if found
 * @throws NotFoundError if user not found
 * @throws AppError if database error occurs
 */
export async function getUser(userId: string) {
  try {
    const user = await prisma.user.findUniqueOrThrow({
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
    throw new AppError(
      error instanceof Error
        ? `Failed to get user: ${error.message}`
        : "An unexpected error occurred while fetching user",
      500
    );
  }
}
