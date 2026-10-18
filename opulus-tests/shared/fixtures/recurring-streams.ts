import { testDb } from "../db.js";

/**
 * Recurring stream fixtures.
 *
 * Streams are born only from a sync of Plaid's data, so specs for the API that
 * shows them seed them straight into the ISOLATED test DB (the setup the
 * conventions allow); everything is then verified over HTTP.
 */

/** Put a stream straight into the store. */
export async function seedStream(params: {
  userId: string;
  itemId: string;
  accountId: string;
  plaidStreamId?: string;
  direction?: "inflow" | "outflow";
  description?: string;
  merchantName?: string | null;
  frequency?: string;
  status?: string;
  isActive?: boolean;
  averageAmount?: number;
  lastAmount?: number;
  currency?: string | null;
  category?: string | null;
  predictedNextDate?: Date | null;
}) {
  return testDb().recurringStream.create({
    data: {
      plaidStreamId: params.plaidStreamId ?? `stream_${Math.random().toString(36).slice(2)}`,
      accountId: params.accountId,
      itemId: params.itemId,
      userId: params.userId,
      direction: params.direction ?? "outflow",
      description: params.description ?? "Seeded stream",
      merchantName: params.merchantName ?? null,
      frequency: params.frequency ?? "MONTHLY",
      status: params.status ?? "MATURE",
      isActive: params.isActive ?? true,
      firstDate: new Date("2026-01-01T00:00:00Z"),
      lastDate: new Date("2026-09-01T00:00:00Z"),
      predictedNextDate: params.predictedNextDate ?? null,
      averageAmount: params.averageAmount ?? 10,
      lastAmount: params.lastAmount ?? params.averageAmount ?? 10,
      isoCurrencyCode: params.currency === undefined ? "CAD" : params.currency,
      category: params.category ?? null,
      syncedAt: new Date(),
    },
  });
}

/** An item's stored streams, by description. */
export async function readStreams(itemId: string) {
  const rows = await testDb().recurringStream.findMany({ where: { itemId } });
  return rows.sort((a, b) => a.description.localeCompare(b.description));
}
