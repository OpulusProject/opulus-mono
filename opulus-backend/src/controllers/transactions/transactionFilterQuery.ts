import {
  TRANSACTION_CATEGORIES,
  TransactionFilters,
  UNCATEGORIZED,
} from "@opulus/core";
import { z } from "zod";

/** An absent or empty query value means "no filter"; anything else is parsed. */
const orUndefined = (val: unknown) =>
  val === undefined || val === null || val === "" ? undefined : val;

/**
 * Optional query values arrive as strings. A value that is present but not valid
 * (`?page=abc`, `?startDate=garbage`) is a 400, not silently ignored: the client
 * would otherwise get unfiltered or first-page data and not know.
 */
const optionalDate = z.preprocess(
  (val) => {
    const v = orUndefined(val);
    return typeof v === "string" ? new Date(v) : v;
  },
  z.date({ invalid_type_error: "Must be a valid date" }).optional()
);

export const optionalInt = (max?: number) => {
  const positiveInt = z.number().int().positive();

  return z.preprocess(
    (val) => {
      const v = orUndefined(val);
      return typeof v === "string" ? Number(v) : v;
    },
    (max ? positiveInt.max(max) : positiveInt).optional()
  );
};

const optionalBoolean = z.preprocess(
  (val) => {
    const v = orUndefined(val);
    return v === "true" ? true : v === "false" ? false : v;
  },
  z.boolean({ invalid_type_error: "Must be true or false" }).optional()
);

/** A value given once or repeated (?itemId=a&itemId=b); empty values are dropped. */
const optionalList = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess(
    (val) => {
      if (val === undefined) return undefined;
      const list = (Array.isArray(val) ? val : [val]).filter((v) => v !== "");
      return list.length > 0 ? list : undefined;
    },
    z.array(item).optional()
  );

/**
 * The filters shared by the transaction list and the summary, so the totals
 * always describe the same set of transactions as the list.
 */
export const transactionFilterQuerySchema = z.object({
  itemId: optionalList(z.string()),
  accountId: optionalList(z.string()),
  category: optionalList(z.enum([...TRANSACTION_CATEGORIES, UNCATEGORIZED])),
  search: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() || undefined : val),
    z.string().max(100).optional()
  ),
  type: z.preprocess(orUndefined, z.enum(["inflow", "outflow"]).optional()),
  hideTransfers: optionalBoolean,
  includePending: optionalBoolean,
  startDate: optionalDate,
  endDate: optionalDate,
});

/** Map validated query values to the repository's filters. */
export function toTransactionFilters(
  query: z.infer<typeof transactionFilterQuerySchema>
): TransactionFilters {
  return {
    ...(query.itemId && { itemIds: query.itemId }),
    ...(query.accountId && { accountIds: query.accountId }),
    ...(query.category && { categories: query.category }),
    ...(query.search && { search: query.search }),
    ...(query.type && { type: query.type }),
    ...(query.hideTransfers !== undefined && {
      hideTransfers: query.hideTransfers,
    }),
    ...(query.includePending !== undefined && {
      includePending: query.includePending,
    }),
    ...(query.startDate && { startDate: query.startDate }),
    ...(query.endDate && { endDate: query.endDate }),
  };
}
