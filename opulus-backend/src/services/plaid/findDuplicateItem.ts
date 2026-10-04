import { prisma } from "@opulus/core";

/**
 * Returns the id of a persisted Item the user has already linked for this
 * institution, or null. Strict policy: one Item per (user, institution).
 */
export async function findDuplicateItem(
  userId: string,
  institutionId: string
): Promise<string | null> {
  const existing = await prisma.item.findFirst({
    where: { userId, institutionId },
    select: { id: true },
  });

  return existing?.id ?? null;
}
