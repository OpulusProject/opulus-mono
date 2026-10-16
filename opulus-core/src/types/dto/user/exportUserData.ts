/**
 * User data export endpoint DTOs
 */

import { z } from "zod";

import { IsoTimestampSchema, toIsoString } from "../common.js";
import { ItemDTOSchema } from "../items/getItems.js";
import { TransactionDTOSchema } from "../transactions/getTransactions.js";

/** The user the export is of. */
export const ExportUserDTOSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  createdAt: IsoTimestampSchema,
});

export type ExportUserDTO = z.infer<typeof ExportUserDTOSchema>;

/**
 * Everything we hold about a user that is theirs: who they are, their
 * connections with the accounts in them (with their balances), and every
 * transaction. The balance history is not in it: it is not stored, it is worked
 * out from the transactions and the balances. Nothing secret is in it: not the password, sessions, two-factor
 * secrets, passkeys or the Plaid access tokens. It is sent as one JSON document
 * (a download), not wrapped in `data`.
 */
export const UserDataExportSchema = z.object({
  exportedAt: IsoTimestampSchema,
  user: ExportUserDTOSchema,
  connections: z.array(ItemDTOSchema),
  /** Oldest first, pending ones included. */
  transactions: z.array(TransactionDTOSchema),
});

export type UserDataExport = z.infer<typeof UserDataExportSchema>;

/** Transform a stored user to the export's user, leaving out everything internal. */
export function toExportUserDTO(user: {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
}): ExportUserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    createdAt: toIsoString(user.createdAt),
  };
}
