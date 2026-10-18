import {
  activityKind,
  addDays,
  BASE_CURRENCY,
  fromUnits,
  investmentTransactionRepository,
  loadExchangeRateConverter,
  toDay,
  toUnits,
  type ActivitySummaryResponse,
} from "@opulus/core";

export interface GetActivitySummaryParams {
  userId: string;
  /** Only this account (our account id). */
  accountId?: string;
  /** The current moment; only tests pass it. */
  now?: Date;
}

/**
 * What a user's investment accounts paid out, charged, took in and gave back
 * over the last twelve months, and what was put in so far this calendar year,
 * all in the base currency at today's rate. Fees are fee transactions plus the
 * fees charged on trades.
 */
export async function getActivitySummary(
  params: GetActivitySummaryParams
): Promise<ActivitySummaryResponse["data"]> {
  const today = toDay(params.now ?? new Date());
  const year = Number(today.slice(0, 4));
  const since = addDays(today, -364);
  // The earlier of the two windows covers both.
  const from = since < `${year}-01-01` ? since : `${year}-01-01`;

  const rows = await investmentTransactionRepository.getForSummary(
    params.userId,
    new Date(`${from}T00:00:00Z`),
    params.accountId
  );
  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: rows.map((row) => row.isoCurrencyCode),
    days: [today],
  });

  let dividends = 0;
  let fees = 0;
  let added = 0;
  let removed = 0;
  let addedThisYear = 0;
  for (const row of rows) {
    const day = toDay(row.date);
    const rate = converter.rateOn(row.isoCurrencyCode, today);
    // Plaid counts money leaving the account as positive.
    const out = toUnits(row.amount.toNumber() * rate);
    const fee = toUnits((row.fees?.toNumber() ?? 0) * rate);
    const kind = activityKind(row.type, row.subtype);

    if (kind === "added" && day >= `${year}-01-01`) addedThisYear -= out;
    if (day < since) continue;
    if (kind === "dividend") dividends -= out;
    else if (kind === "added") added -= out;
    else if (kind === "removed") removed += out;
    else if (kind === "fee") fees += out;
    if (kind === "buy" || kind === "sell") fees += fee;
  }

  return {
    baseCurrency: BASE_CURRENCY,
    since,
    dividends: fromUnits(dividends),
    fees: fromUnits(fees),
    added: fromUnits(added),
    removed: fromUnits(removed),
    year,
    addedThisYear: fromUnits(addedThisYear),
  };
}
