import { Prisma } from "@prisma/client";
import prisma from "@/client/prisma.js";
import { NotFoundError, AppError } from "@/utils/errors.js";

interface UpdateUserData {
  id: string;
  plaidId?: string;
  plaidUserToken?: string;
  name?: string;
  email?: string;
  image?: string;
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
export async function updateUser(data: UpdateUserData) {
  const { id, ...updateData } = data;

  try {
    return await prisma.user.update({
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
    throw new AppError(
      error instanceof Error
        ? `Failed to update user: ${error.message}`
        : "An unexpected error occurred while updating user",
      500
    );
  }
}
