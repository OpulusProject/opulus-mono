/**
 * Get Transactions endpoint DTOs
 */

import { PaginationMetadata } from "../common.js";

/**
 * Transaction DTO matching the API response
 * Dates are serialized as ISO strings
 */
export interface Transaction {
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
  bankAccount: {
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
    transactions: Transaction[];
    pagination: PaginationMetadata;
  };
}
