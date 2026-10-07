import type { Prisma } from "@prisma/client";
import prisma from "./prisma.js";

/**
 * Run several repository calls as one database transaction: they all happen, or
 * none do. Pass the transaction client to each repository call that should
 * join it.
 *
 *   await runInTransaction(async (tx) => {
 *     await transactionRepository.deleteByItemId(itemId, tx);
 *     await itemRepository.delete(itemId, tx);
 *   });
 *
 * Services use this instead of importing the Prisma client, so Prisma stays
 * inside the repositories.
 */
export function runInTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn);
}
