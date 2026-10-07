/**
 * Get Transactions endpoint DTOs
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  IsoTimestampSchema,
  PaginationMetadataSchema,
  toIsoString,
} from "../common.js";

/**
 * Transaction DTO matching the API response
 * Dates are serialized as ISO strings
 */
export const TransactionDTOSchema = z.object({
  id: z.string(),
  providerTransactionId: z.string(),
  accountId: z.string(),
  itemId: z.string(),
  userId: z.string(),
  amount: z.number(),
  date: IsoTimestampSchema,
  authorizedDate: IsoTimestampSchema.nullable(),
  name: z.string(),
  merchantName: z.string().nullable(),
  category: z.array(z.string()),
  categoryId: z.string().nullable(),
  personalFinanceCategory: z.string().nullable(),
  location: z.string().nullable(),
  paymentMeta: z.string().nullable(),
  isoCurrencyCode: z.string().nullable(),
  unofficialCurrencyCode: z.string().nullable(),
  pending: z.boolean(),
  pendingTransactionId: z.string().nullable(),
  accountOwner: z.string().nullable(),
  transactionCode: z.string().nullable(),
  merchantEntityId: z.string().nullable(),
  checkNumber: z.string().nullable(),
  dateTransacted: IsoTimestampSchema.nullable(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
  account: z.object({
    id: z.string(),
    name: z.string(),
    mask: z.string().nullable(),
  }),
});

export type TransactionDTO = z.infer<typeof TransactionDTOSchema>;

/**
 * Transactions API response with pagination
 */
export const TransactionsResponseSchema = z.object({
  data: z.object({
    transactions: z.array(TransactionDTOSchema),
    pagination: PaginationMetadataSchema,
  }),
});

export type TransactionsResponse = z.infer<typeof TransactionsResponseSchema>;

/**
 * A transaction row with the account columns the API includes
 */
type TransactionWithAccount = Prisma.TransactionGetPayload<{
  include: { account: { select: { id: true; name: true; mask: true } } };
}>;

/**
 * Transform a stored transaction row to its public DTO. Converts the decimal
 * amount to a number and dates to ISO strings, and only passes through the
 * documented fields.
 */
export function toTransactionDTO(
  transaction: TransactionWithAccount
): TransactionDTO {
  return {
    id: transaction.id,
    providerTransactionId: transaction.providerTransactionId,
    accountId: transaction.accountId,
    itemId: transaction.itemId,
    userId: transaction.userId,
    amount: transaction.amount.toNumber(),
    date: toIsoString(transaction.date),
    authorizedDate: toIsoString(transaction.authorizedDate),
    name: transaction.name,
    merchantName: transaction.merchantName,
    category: transaction.category,
    categoryId: transaction.categoryId,
    personalFinanceCategory: transaction.personalFinanceCategory,
    location: transaction.location,
    paymentMeta: transaction.paymentMeta,
    isoCurrencyCode: transaction.isoCurrencyCode,
    unofficialCurrencyCode: transaction.unofficialCurrencyCode,
    pending: transaction.pending,
    pendingTransactionId: transaction.pendingTransactionId,
    accountOwner: transaction.accountOwner,
    transactionCode: transaction.transactionCode,
    merchantEntityId: transaction.merchantEntityId,
    checkNumber: transaction.checkNumber,
    dateTransacted: toIsoString(transaction.dateTransacted),
    createdAt: toIsoString(transaction.createdAt),
    updatedAt: toIsoString(transaction.updatedAt),
    account: {
      id: transaction.account.id,
      name: transaction.account.name,
      mask: transaction.account.mask,
    },
  };
}
