import {
  itemRepository,
  toExportUserDTO,
  toIsoString,
  toItemDTO,
  toTransactionDTO,
  transactionRepository,
  userRepository,
} from "@opulus/core";

/** Transactions are read, and written out, this many at a time. */
const PAGE_SIZE = 1000;

export interface UserExport {
  /**
   * The export as JSON text, in pieces: the document so far, then the
   * transactions a page at a time. A person with years of transactions has far
   * more than should be held in memory as one string.
   */
  chunks(): AsyncGenerator<string, void, undefined>;
}

/**
 * Prepare an export of everything a user owns: who they are, their connections
 * and accounts, and every transaction. The parts that
 * are small are read here, before anything is sent, so that if one fails the
 * caller can still answer with an error; the transactions are read as the
 * chunks are consumed.
 *
 * The document is `{ exportedAt, user, connections, transactions }` (see `UserDataExportSchema`). The access tokens, password,
 * sessions and two-factor secrets are not in it.
 */
export async function exportUserData(params: {
  userId: string;
}): Promise<UserExport> {
  const { userId } = params;

  const [user, items] = await Promise.all([
    userRepository.getById(userId),
    itemRepository.getAllByUserId(userId),
  ]);

  const head = JSON.stringify({
    exportedAt: toIsoString(new Date()),
    user: toExportUserDTO(user),
    connections: items.map(toItemDTO),
  });

  return {
    async *chunks() {
      // The head is a complete object; reopen it to add the transactions.
      yield `${head.slice(0, -1)},"transactions":[`;

      let first = true;
      for (let page = 1; ; page++) {
        const { transactions, pagination } =
          await transactionRepository.getAllByUserId(
            userId,
            {},
            { page, limit: PAGE_SIZE },
            { by: "date", order: "asc" }
          );
        for (const transaction of transactions) {
          yield `${first ? "" : ","}${JSON.stringify(toTransactionDTO(transaction))}`;
          first = false;
        }
        if (page >= pagination.totalPages) break;
      }

      yield "]}";
    },
  };
}
