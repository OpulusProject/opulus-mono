import { Prisma } from "@prisma/client";
import prisma from "@/client/prisma.js";
import { ConflictError, AppError } from "@/utils/errors.js";

interface CreateLinkSessionData {
  userId: string;
  linkToken: string;
}

/**
 * Create a link session in the database
 * @param data - Link session data
 * @returns Created link session
 * @throws ConflictError if link token already exists
 * @throws AppError if database error occurs
 */
export async function createLinkSession(data: CreateLinkSessionData) {
  try {
    return await prisma.linkSession.create({
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
    throw new AppError(
      error instanceof Error
        ? `Failed to create link session: ${error.message}`
        : "An unexpected error occurred while creating link session",
      500
    );
  }
}
