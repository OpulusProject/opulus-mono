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

export const TransactionCategoryDTOSchema = z.object({
  /** High level, e.g. FOOD_AND_DRINK (see TRANSACTION_CATEGORIES). */
  primary: z.string(),
  /** Granular, e.g. FOOD_AND_DRINK_FAST_FOOD. */
  detailed: z.string().nullable(),
});

export type TransactionCategoryDTO = z.infer<
  typeof TransactionCategoryDTOSchema
>;

export const TransactionLocationDTOSchema = z.object({
  address: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  storeNumber: z.string().nullable(),
});

export type TransactionLocationDTO = z.infer<
  typeof TransactionLocationDTOSchema
>;

export const TransactionPaymentMetaDTOSchema = z.object({
  referenceNumber: z.string().nullable(),
  ppdId: z.string().nullable(),
  payee: z.string().nullable(),
  byOrderOf: z.string().nullable(),
  payer: z.string().nullable(),
  paymentMethod: z.string().nullable(),
  paymentProcessor: z.string().nullable(),
  reason: z.string().nullable(),
});

export type TransactionPaymentMetaDTO = z.infer<
  typeof TransactionPaymentMetaDTOSchema
>;

/**
 * What we keep of Plaid's `location` and `payment_meta` objects, in Plaid's own
 * (snake_case) names. Anything that doesn't fit is dropped rather than failing
 * the request.
 */
const StoredLocationSchema = z.object({
  address: z.string().nullish(),
  city: z.string().nullish(),
  region: z.string().nullish(),
  postal_code: z.string().nullish(),
  country: z.string().nullish(),
  lat: z.number().nullish(),
  lon: z.number().nullish(),
  store_number: z.string().nullish(),
});

const StoredPaymentMetaSchema = z.object({
  reference_number: z.string().nullish(),
  ppd_id: z.string().nullish(),
  payee: z.string().nullish(),
  by_order_of: z.string().nullish(),
  payer: z.string().nullish(),
  payment_method: z.string().nullish(),
  payment_processor: z.string().nullish(),
  reason: z.string().nullish(),
});

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
  /** Plaid's category for the transaction, or null when it has none. */
  category: TransactionCategoryDTOSchema.nullable(),
  /** online, in store or other. */
  paymentChannel: z.string().nullable(),
  /** The merchant's logo (a 100x100 PNG on Plaid's CDN), when Plaid has one. */
  logoUrl: z.string().nullable(),
  website: z.string().nullable(),
  /** Only for transactions at physical locations. */
  location: TransactionLocationDTOSchema.nullable(),
  /** Only for inter-bank transfers. */
  paymentMeta: TransactionPaymentMetaDTOSchema.nullable(),
  isoCurrencyCode: z.string().nullable(),
  unofficialCurrencyCode: z.string().nullable(),
  pending: z.boolean(),
  pendingTransactionId: z.string().nullable(),
  accountOwner: z.string().nullable(),
  transactionCode: z.string().nullable(),
  merchantEntityId: z.string().nullable(),
  checkNumber: z.string().nullable(),
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
    category: transaction.categoryPrimary
      ? {
          primary: transaction.categoryPrimary,
          detailed: transaction.categoryDetailed,
        }
      : null,
    paymentChannel: transaction.paymentChannel,
    logoUrl: transaction.logoUrl,
    website: transaction.website,
    location: toLocationDTO(transaction.location),
    paymentMeta: toPaymentMetaDTO(transaction.paymentMeta),
    isoCurrencyCode: transaction.isoCurrencyCode,
    unofficialCurrencyCode: transaction.unofficialCurrencyCode,
    pending: transaction.pending,
    pendingTransactionId: transaction.pendingTransactionId,
    accountOwner: transaction.accountOwner,
    transactionCode: transaction.transactionCode,
    merchantEntityId: transaction.merchantEntityId,
    checkNumber: transaction.checkNumber,
    createdAt: toIsoString(transaction.createdAt),
    updatedAt: toIsoString(transaction.updatedAt),
    account: {
      id: transaction.account.id,
      name: transaction.account.name,
      mask: transaction.account.mask,
    },
  };
}

function toLocationDTO(
  stored: Prisma.JsonValue | null
): TransactionLocationDTO | null {
  const parsed = StoredLocationSchema.safeParse(stored);
  if (!parsed.success) return null;
  const l = parsed.data;
  return {
    address: l.address ?? null,
    city: l.city ?? null,
    region: l.region ?? null,
    postalCode: l.postal_code ?? null,
    country: l.country ?? null,
    lat: l.lat ?? null,
    lon: l.lon ?? null,
    storeNumber: l.store_number ?? null,
  };
}

function toPaymentMetaDTO(
  stored: Prisma.JsonValue | null
): TransactionPaymentMetaDTO | null {
  const parsed = StoredPaymentMetaSchema.safeParse(stored);
  if (!parsed.success) return null;
  const p = parsed.data;
  return {
    referenceNumber: p.reference_number ?? null,
    ppdId: p.ppd_id ?? null,
    payee: p.payee ?? null,
    byOrderOf: p.by_order_of ?? null,
    payer: p.payer ?? null,
    paymentMethod: p.payment_method ?? null,
    paymentProcessor: p.payment_processor ?? null,
    reason: p.reason ?? null,
  };
}
