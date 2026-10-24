import { getValidatedQuery } from "@/middleware/validation.js";
import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getSpendingByMerchant } from "@/services/transactions/getSpendingByMerchant.js";
import { SpendingByMerchantResponse } from "@opulus/core";
import { Request, Response } from "express";
import {
  optionalInt,
  toTransactionFilters,
  transactionFilterQuerySchema,
} from "./transactionFilterQuery.js";

/** The same filters as the list, plus how many merchants to list by name. */
export const getSpendingByMerchantQuerySchema =
  transactionFilterQuerySchema.extend({
    top: optionalInt(50),
  });

/**
 * Spending by merchant for the filtered transactions, converted to the base
 * currency, each with its share of the total
 * GET /api/transactions/spending-by-merchant?startDate=2026-09-01&hideTransfers=true&top=5
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getSpendingByMerchantController(
  req: Request,
  res: Response<SpendingByMerchantResponse>
) {
  const session = getRequestSession(res);

  const query = getValidatedQuery<typeof getSpendingByMerchantQuerySchema>(req);

  const data = await getSpendingByMerchant({
    userId: session.user.id,
    filters: toTransactionFilters(query),
    top: query.top,
  });

  res.status(200).json({ data });
}
