import type { TransactionCategory } from '@opulus/core/dto';

/** Repeat array values (?category=A&category=B) rather than category[]=A. */
export const QUERY_SERIALIZER = { indexes: null } as const;

/** The filters for a list of transactions. */
export interface TransactionFilterParams {
  itemId?: string;
  /** Only these connections (institutions). */
  itemIds?: string[];
  accountIds?: string[];
  categories?: Array<TransactionCategory | 'UNCATEGORIZED'>;
  search?: string;
  type?: 'inflow' | 'outflow';
  hideTransfers?: boolean;
  /** A `YYYY-MM-DD` day (inclusive), or a Date. */
  startDate?: string | Date;
  endDate?: string | Date;
}

const toDateParam = (date: string | Date) =>
  typeof date === 'string' ? date : date.toISOString();

export interface TransactionListParams extends TransactionFilterParams {
  accountId?: string;
  sort?: 'date' | 'amount';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/** Turn the params into the API's query values, leaving out the unset ones. */
export function toQueryParams(params: TransactionListParams = {}) {
  return {
    itemId: params.itemIds?.length ? params.itemIds : params.itemId,
    accountId: params.accountIds?.length ? params.accountIds : params.accountId,
    category: params.categories?.length ? params.categories : undefined,
    search: params.search || undefined,
    type: params.type,
    hideTransfers: params.hideTransfers,
    startDate: params.startDate && toDateParam(params.startDate),
    endDate: params.endDate && toDateParam(params.endDate),
    sort: params.sort,
    order: params.order,
    page: params.page,
    limit: params.limit,
  };
}
