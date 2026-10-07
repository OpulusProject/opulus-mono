/**
 * Get Transactions endpoint DTOs
 */

import type { Prisma } from "@prisma/client";

import { PaginationMetadata, toIsoString } from "../common.js";

/**
 * Transaction DTO matching the API response
 * Dates are serialized as ISO strings
 */
export interface TransactionDTO {
  id: string;
  providerTransactionId: string;
  accountId: string;
  itemId: string;
  userId: string;
  amount: number;
  date: string; // ISO string
  authorizedDate: string | null; // ISO string or null
  name: string;
  merchantName: string | null;
  category: string[];
  categoryId: string | null;
  personalFinanceCategory: string | null;
  location: string | null;
  paymentMeta: string | null;
  isoCurrencyCode: string | null;
  unofficialCurrencyCode: string | null;
  pending: boolean;
  pendingTransactionId: string | null;
  accountOwner: string | null;
  transactionCode: string | null;
  merchantEntityId: string | null;
  checkNumber: string | null;
  dateTransacted: string | null; // ISO string or null
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  account: {
    id: string;
    name: string;
    mask: string | null;
  };
}

/**
 * Transactions API response with pagination
 */
export interface TransactionsResponse {
  data: {
    transactions: TransactionDTO[];
    pagination: PaginationMetadata;
  };
}

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
