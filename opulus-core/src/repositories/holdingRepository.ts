import { Prisma, PrismaClient } from "@prisma/client";
import type { Holding as PlaidHolding, Security as PlaidSecurity } from "plaid";
import prisma from "../client/prisma.js";
import { AppError } from "../utils/errors.js";
import { trackSecurity } from "./securityTrackingRepository.js";

/** A security ready to upsert, keyed by Plaid's security id. */
export interface NormalizedSecurity {
  plaidSecurityId: string;
  data: {
    name: string | null;
    tickerSymbol: string | null;
    type: string | null;
    isCashEquivalent: boolean;
    isoCurrencyCode: string | null;
    closePrice: number | null;
    closePriceAsOf: Date | null;
    unofficialCurrencyCode: string | null;
    marketIdentifierCode: string | null;
    optionContractType: string | null;
    optionExpirationDate: Date | null;
    optionStrikePrice: number | null;
    optionUnderlyingTicker: string | null;
    bondMaturityDate: Date | null;
    bondIssueDate: Date | null;
    bondFaceValue: number | null;
    bondYieldRate: number | null;
    bondYieldType: string | null;
  };
}

/** A holding ready to store, keyed by Plaid's account and security ids. */
export interface NormalizedHolding {
  providerAccountId: string;
  plaidSecurityId: string;
  data: {
    quantity: number;
    institutionPrice: number;
    institutionPriceAsOf: Date | null;
    institutionValue: number;
    costBasis: number | null;
    isoCurrencyCode: string | null;
  };
}

const toDate = (value: string | null | undefined): Date | null =>
  value ? new Date(value) : null;

/**
 * Normalize one of Plaid's securities. Only what the API shows is kept: no
 * CUSIP, ISIN or SEDOL. An option's contract and a bond's terms are kept, for
 * the holding's detail.
 */
export function normalizePlaidSecurity(
  security: PlaidSecurity
): NormalizedSecurity {
  const fixedIncome = security.fixed_income;
  const option = security.option_contract;
  return {
    plaidSecurityId: security.security_id,
    data: {
      name: security.name ?? null,
      tickerSymbol: security.ticker_symbol ?? null,
      type: security.type ?? null,
      isCashEquivalent: security.is_cash_equivalent ?? false,
      isoCurrencyCode: security.iso_currency_code ?? null,
      closePrice: security.close_price ?? null,
      closePriceAsOf: toDate(security.close_price_as_of),
      unofficialCurrencyCode: security.unofficial_currency_code ?? null,
      marketIdentifierCode: security.market_identifier_code ?? null,
      optionContractType: option?.contract_type ?? null,
      optionExpirationDate: toDate(option?.expiration_date),
      optionStrikePrice: option?.strike_price ?? null,
      optionUnderlyingTicker: option?.underlying_security_ticker ?? null,
      bondMaturityDate: toDate(fixedIncome?.maturity_date),
      bondIssueDate: toDate(fixedIncome?.issue_date),
      bondFaceValue: fixedIncome?.face_value ?? null,
      bondYieldRate: fixedIncome?.yield_rate?.percentage ?? null,
      bondYieldType: fixedIncome?.yield_rate?.type ?? null,
    },
  };
}

/**
 * Upsert securities inside a transaction, and track each (see
 * `trackSecurity`). Returns our id for each, by Plaid's security id.
 */
export async function upsertSecurities(
  tx: Prisma.TransactionClient,
  securities: NormalizedSecurity[]
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const { plaidSecurityId, data } of securities) {
    const stored = await tx.security.upsert({
      where: { plaidSecurityId },
      create: { plaidSecurityId, ...data },
      update: data,
      select: {
        id: true,
        priceStatus: true,
        priceSymbol: true,
        priceSymbolSource: true,
      },
    });
    await trackSecurity(tx, stored, data);
    ids.set(plaidSecurityId, stored.id);
  }
  return ids;
}

/**
 * Normalize Plaid's holdings and securities. A holding in a security Plaid did
 * not describe is dropped: it cannot be shown without one.
 */
export function normalizePlaidHoldings(response: {
  holdings: PlaidHolding[];
  securities: PlaidSecurity[];
}): { securities: NormalizedSecurity[]; holdings: NormalizedHolding[] } {
  const securities = response.securities.map(normalizePlaidSecurity);
  const known = new Set(securities.map((s) => s.plaidSecurityId));

  const holdings = response.holdings
    .filter((holding) => known.has(holding.security_id))
    .map((holding) => ({
      providerAccountId: holding.account_id,
      plaidSecurityId: holding.security_id,
      data: {
        quantity: holding.quantity,
        institutionPrice: holding.institution_price,
        institutionPriceAsOf: toDate(holding.institution_price_as_of),
        institutionValue: holding.institution_value,
        costBasis: holding.cost_basis ?? null,
        isoCurrencyCode: holding.iso_currency_code ?? null,
      },
    }));

  return { securities, holdings };
}

/**
 * Repository for securities and holdings
 * A holding is a snapshot as of Plaid's last pull, so each sync replaces an
 * account's holdings instead of adding to them
 */
class HoldingRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Store an item's holdings from a sync: upsert the securities, upsert the
   * holdings, and delete the holdings of these accounts that are no longer held
   * (sold, or moved), all in one transaction so a reader never sees half.
   * @param item - The item (and user) the holdings belong to
   * @param accountIds - Our ids of the accounts the sync covered: holdings of
   *   these that are not in `holdings` are removed
   * @param securities - The securities the holdings are in
   * @param holdings - Each holding, with our account id
   * @throws AppError if database error occurs
   */
  async replaceForAccounts(
    item: { id: string; userId: string },
    accountIds: string[],
    securities: NormalizedSecurity[],
    holdings: Array<
      Pick<NormalizedHolding, "plaidSecurityId" | "data"> & {
        accountId: string;
      }
    >
  ): Promise<void> {
    const syncedAt = new Date();

    try {
      await this.prisma.$transaction(async (tx) => {
        const securityIds = await upsertSecurities(tx, securities);

        const kept: Array<{ accountId: string; securityId: string }> = [];
        for (const { accountId, plaidSecurityId, data } of holdings) {
          const securityId = securityIds.get(plaidSecurityId)!;
          await tx.holding.upsert({
            where: { accountId_securityId: { accountId, securityId } },
            create: {
              ...data,
              accountId,
              securityId,
              itemId: item.id,
              userId: item.userId,
              syncedAt,
            },
            update: { ...data, syncedAt },
          });
          kept.push({ accountId, securityId });
        }

        // What is no longer held: everything of these accounts that was not just written.
        await tx.holding.deleteMany({
          where: {
            accountId: { in: accountIds },
            NOT: kept.length > 0 ? { OR: kept } : undefined,
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to store holdings: ${error.message}`
          : "An unexpected error occurred while storing holdings";
      throw new AppError(message, 500);
    }
  }

  /**
   * A user's current holdings, with their security, account name and the
   * institution's name. Only the user's own, whatever the filter.
   * @param userId - The user
   * @param filters - Only these accounts' holdings (our account ids), or holdings
   *   of this security (our id)
   * @throws AppError if database error occurs
   */
  async getAllByUserId(
    userId: string,
    filters: {
      accountIds?: string[];
      securityId?: string;
    } = {}
  ) {
    try {
      return await this.prisma.holding.findMany({
        where: {
          userId,
          ...(filters.accountIds && { accountId: { in: filters.accountIds } }),
          securityId: filters.securityId,
        },
        include: {
          security: true,
          account: { select: { name: true, subtype: true, mask: true } },
          item: { select: { institutionName: true } },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to get holdings: ${error.message}`
          : "An unexpected error occurred while fetching holdings";
      throw new AppError(message, 500);
    }
  }
}

// Export singleton instance
export const holdingRepository = new HoldingRepository(prisma);
