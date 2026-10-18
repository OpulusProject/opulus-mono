import {
  AccountBase,
  AccountsBalanceGetRequest,
  AccountsGetRequest,
  CountryCode,
  InstitutionsGetByIdRequest,
  InstitutionsGetRequest,
  InvestmentsHoldingsGetRequest,
  InvestmentsTransactionsGetRequest,
  InvestmentsTransactionsGetResponse,
  InvestmentTransaction,
  ItemGetRequest,
  ItemPublicTokenExchangeRequest,
  ItemRemoveRequest,
  LiabilitiesGetRequest,
  LinkTokenCreateRequest,
  PlaidApi,
  Products,
  TransactionsRecurringGetRequest,
  TransactionsSyncRequest,
  TransactionsUpdateStatus,
  UserCreateRequest,
  Security,
} from "plaid";
import plaidClient from "../client/plaid.js";
import config from "../config/default.js";
import { getPlaidErrorCode, handlePlaidError } from "../utils/plaidErrors.js";

/**
 * Gateway to the Plaid API
 * Handles Plaid API interactions including users, tokens, items, and accounts
 */
class PlaidGateway {
  constructor(private plaid: PlaidApi) {}

  // ============================================================================
  // User Management
  // ============================================================================

  /**
   * Create a Plaid user
   * @param userId - User ID from your database
   * @returns Plaid user creation response
   */
  async createUser(userId: string) {
    const request: UserCreateRequest = {
      client_user_id: userId,
    };

    try {
      const response = await this.plaid.userCreate(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  // ============================================================================
  // Link Token Management
  // ============================================================================

  /**
   * Create a Plaid Link token for the user
   * @param userToken - Plaid user token (from userCreate)
   * @param userId - User ID from your database
   * @returns Link token response from Plaid
   */
  async createLinkToken(userToken: string, userId: string) {
    // Only what we use. Every product here must be supported by an institution
    // for Link to offer it, so an unused one (Assets, which we never read) only
    // hides institutions. Transaction history comes from `days_requested`.
    const products: Products[] = [Products.Transactions];
    // Liabilities (APRs, payment due dates, loan terms) is only extracted when
    // the institution supports it. Putting it in `products` would hide every
    // institution without support from Link, which matters in Canada where
    // coverage is limited. Plaid bills it per item, only where it applies.
    // Investments (holdings: what is held, its price and what was paid) is the
    // same: only where the institution supports it.
    const requiredIfSupportedProducts: Products[] = [
      Products.Liabilities,
      Products.Investments,
    ];
    const countryCodes: CountryCode[] = [CountryCode.Ca];

    const request: LinkTokenCreateRequest = {
      user_token: userToken,
      user: {
        client_user_id: userId,
      },
      client_name: "Opulus",
      products,
      required_if_supported_products: requiredIfSupportedProducts,
      country_codes: countryCodes,
      language: "en",
      transactions: {
        days_requested: 730,
      },
      ...(config.plaidWebhookUrl && {
        webhook: config.plaidWebhookUrl,
      }),
      ...(config.plaidRedirectUri && {
        redirect_uri: config.plaidRedirectUri,
      }),
    };

    try {
      const response = await this.plaid.linkTokenCreate(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  /**
   * Create a Link token in update mode for an existing item.
   * Omits products; Plaid uses the access token to repair the item.
   * With `selectAccounts`, Link also lets the user choose which accounts to
   * share, which is how accounts that appeared since the item was linked get
   * added (not available for EU/UK institutions).
   * https://plaid.com/docs/link/update-mode/
   */
  async createUpdateLinkToken(
    accessToken: string,
    userId: string,
    options: { selectAccounts?: boolean } = {}
  ) {
    const request: LinkTokenCreateRequest = {
      user: {
        client_user_id: userId,
      },
      client_name: "Opulus",
      country_codes: [CountryCode.Ca],
      language: "en",
      access_token: accessToken,
      ...(options.selectAccounts && {
        update: { account_selection_enabled: true },
      }),
      ...(config.plaidWebhookUrl && {
        webhook: config.plaidWebhookUrl,
      }),
      ...(config.plaidRedirectUri && {
        redirect_uri: config.plaidRedirectUri,
      }),
    };

    try {
      const response = await this.plaid.linkTokenCreate(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  // ============================================================================
  // Item Management
  // ============================================================================

  /**
   * Exchange a public token for an access token
   * Creates a new Plaid item (connection to a financial institution) for the user
   * @param publicToken - The public token obtained from Plaid Link
   * @returns The access token and item ID from the exchange
   */
  async exchangePublicToken(publicToken: string) {
    const request: ItemPublicTokenExchangeRequest = {
      public_token: publicToken,
    };

    try {
      const response = await this.plaid.itemPublicTokenExchange(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  /**
   * Get a Plaid item by access token
   * @param accessToken - The access token obtained from the public token exchange
   * @returns The item from Plaid
   */
  async getItem(accessToken: string) {
    const request: ItemGetRequest = {
      access_token: accessToken,
    };

    try {
      const response = await this.plaid.itemGet(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  /**
   * Remove a Plaid item by access token
   * Treats an item Plaid no longer knows about (e.g. the user disconnected it
   * directly through Plaid) as already removed
   * @param accessToken - The access token for the specified item
   * @returns Unique identifier for the request, or null if the item was already removed
   */
  async removeItem(accessToken: string) {
    const request: ItemRemoveRequest = {
      access_token: accessToken,
    };

    try {
      const response = await this.plaid.itemRemove(request);
      return response.data;
    } catch (error) {
      if (getPlaidErrorCode(error) === "ITEM_NOT_FOUND") {
        return null;
      }
      throw handlePlaidError(error);
    }
  }

  // ============================================================================
  // Liabilities
  // ============================================================================

  /**
   * Fetch liabilities (credit card, mortgage, and student loan details) for an item
   * @param accessToken - The access token for the item
   * @param accountIds - Optional Plaid account IDs to limit the response to
   * @returns Liabilities and the item's accounts
   */
  async getLiabilities(accessToken: string, accountIds?: string[]) {
    const request: LiabilitiesGetRequest = {
      access_token: accessToken,
      ...(accountIds?.length && { options: { account_ids: accountIds } }),
    };

    try {
      const response = await this.plaid.liabilitiesGet(request);
      return response.data;
    } catch (error) {
      // The SDK wraps Plaid's error body in an axios error. Unwrap it so the
      // resulting AppError carries Plaid's own error_code, which callers use to
      // tell "not available for this item" apart from real failures.
      const plaidBody = (error as { response?: { data?: unknown } } | null)
        ?.response?.data;
      throw handlePlaidError(plaidBody ?? error);
    }
  }

  // ============================================================================
  // Recurring transactions
  // ============================================================================

  /**
   * Fetch the recurring payments and income (Plaid's "streams") it found in an
   * item's transactions. Needs the item's transactions to be loaded first, and
   * Plaid sends a RECURRING_TRANSACTIONS_UPDATE webhook when they are ready or
   * change.
   * @param accessToken - The access token for the item
   * @param accountIds - Plaid account IDs to look at (all the item's if omitted)
   * @returns Inflow and outflow streams
   */
  async getRecurringTransactions(accessToken: string, accountIds?: string[]) {
    const request: TransactionsRecurringGetRequest = {
      access_token: accessToken,
      options: { include_personal_finance_category: true },
      ...(accountIds?.length && { account_ids: accountIds }),
    };

    try {
      const response = await this.plaid.transactionsRecurringGet(request);
      return response.data;
    } catch (error) {
      // Unwrap Plaid's error body so the AppError carries its error_code.
      const plaidBody = (error as { response?: { data?: unknown } } | null)
        ?.response?.data;
      throw handlePlaidError(plaidBody ?? error);
    }
  }

  // ============================================================================
  // Investments
  // ============================================================================

  /**
   * Fetch an item's investment holdings (what each investment account holds,
   * and what Plaid knows about each security). The data is as fresh as Plaid's
   * last pull from the institution, usually about daily.
   * @param accessToken - The access token for the item
   * @param accountIds - Optional Plaid account IDs to limit the response to
   * @returns Holdings, securities and the item's investment accounts
   */
  async getInvestmentHoldings(accessToken: string, accountIds?: string[]) {
    const request: InvestmentsHoldingsGetRequest = {
      access_token: accessToken,
      ...(accountIds?.length && { options: { account_ids: accountIds } }),
    };

    try {
      const response = await this.plaid.investmentsHoldingsGet(request);
      return response.data;
    } catch (error) {
      // Unwrap Plaid's error body so the AppError carries its error_code (as for
      // liabilities): callers tell "not available for this item" from a failure.
      const plaidBody = (error as { response?: { data?: unknown } } | null)
        ?.response?.data;
      throw handlePlaidError(plaidBody ?? error);
    }
  }

  /**
   * Fetch an item's investment transactions (buys, sells, dividends, deposits,
   * fees) from a period, following Plaid's pages until it has them all. Plaid
   * keeps up to 24 months.
   * @param accessToken - The access token for the item
   * @param startDate - First day, "YYYY-MM-DD"
   * @param endDate - Last day, "YYYY-MM-DD"
   * @returns The transactions, the securities they mention and the item's investment accounts
   */
  async getInvestmentTransactions(
    accessToken: string,
    startDate: string,
    endDate: string
  ) {
    const PAGE = 500;
    try {
      const transactions: InvestmentTransaction[] = [];
      const securities = new Map<string, Security>();
      let accounts: InvestmentsTransactionsGetResponse["accounts"] = [];
      let total = Infinity;

      while (transactions.length < total) {
        const request: InvestmentsTransactionsGetRequest = {
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
          options: { count: PAGE, offset: transactions.length },
        };
        const { data } = await this.plaid.investmentsTransactionsGet(request);
        total = data.total_investment_transactions;
        accounts = data.accounts;
        for (const security of data.securities) {
          securities.set(security.security_id, security);
        }
        transactions.push(...data.investment_transactions);
        // A page that adds nothing would never reach the total.
        if (data.investment_transactions.length === 0) break;
      }

      return {
        investmentTransactions: transactions,
        securities: [...securities.values()],
        accounts,
      };
    } catch (error) {
      // Unwrap Plaid's error body so the AppError carries its error_code (as for
      // holdings): callers tell "not available for this item" from a failure.
      const plaidBody = (error as { response?: { data?: unknown } } | null)
        ?.response?.data;
      throw handlePlaidError(plaidBody ?? error);
    }
  }

  // ============================================================================
  // Institution Management
  // ============================================================================

  /**
   * Get institution details by ID
   * @param institutionId - The Plaid institution ID
   * @returns Institution details with optional metadata
   */
  async getInstitutionById(institutionId: string) {
    const request: InstitutionsGetByIdRequest = {
      institution_id: institutionId,
      country_codes: [CountryCode.Ca],
      options: {
        include_optional_metadata: true,
      },
    };

    try {
      const response = await this.plaid.institutionsGetById(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  /**
   * Get all institutions from Plaid
   * Supports pagination to retrieve all available institutions
   * @returns List of institutions with total count
   */
  async getInstitutions() {
    const request: InstitutionsGetRequest = {
      count: 500, // Plaid max is 500
      offset: 0,
      country_codes: [CountryCode.Ca],
      options: {
        include_optional_metadata: true,
      },
    };

    try {
      const response = await this.plaid.institutionsGet(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  // ============================================================================
  // Account Management
  // ============================================================================

  /**
   * Get accounts for a Plaid item
   * @param accessToken - The access token for the item
   * @returns The accounts from Plaid
   */
  async getAccounts(accessToken: string) {
    const request: AccountsGetRequest = {
      access_token: accessToken,
    };

    try {
      const response = await this.plaid.accountsGet(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  /**
   * Get an item's accounts with their balances read from the institution now.
   * Unlike `getAccounts`, whose balances Plaid may serve from a cache, this asks
   * the institution, and Plaid bills each call, so use it sparingly.
   * @param accessToken - The access token for the item
   * @returns The accounts from Plaid, with fresh balances
   */
  async getBalances(accessToken: string) {
    const request: AccountsBalanceGetRequest = {
      access_token: accessToken,
    };

    try {
      const response = await this.plaid.accountsBalanceGet(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  // ============================================================================
  // Transaction Management
  // ============================================================================

  /**
   * Sync transactions for a Plaid item
   * Handles pagination automatically and returns all transactions
   * @param accessToken - The access token for the item
   * @param cursor - Optional cursor for incremental updates (null for initial sync)
   * @returns Object containing added, modified, removed transactions and next cursor
   */
  async transactionsSync(accessToken: string, cursor: string | null = null) {
    const allAdded: any[] = [];
    const allModified: any[] = [];
    const allRemoved: any[] = [];
    // The accounts Plaid listed with these transactions, by id (each page
    // repeats them; only accounts that have transactions in the response are
    // listed). Their balances are at least as recent as the transactions.
    const accountsById = new Map<string, AccountBase>();
    let nextCursor: string | null = cursor;
    let originalCursor: string | null = cursor; // Track original cursor for pagination restarts
    let transactionsUpdateStatus: TransactionsUpdateStatus | undefined;

    try {
      // Pagination loop - continue until has_more is false
      while (true) {
        const request: TransactionsSyncRequest = {
          access_token: accessToken,
          cursor: nextCursor ?? undefined,
        };

        const response = await this.plaid.transactionsSync(request);
        const {
          added,
          modified,
          removed,
          has_more,
          next_cursor,
          transactions_update_status,
          accounts,
        } = response.data;

        // Accumulate transactions
        allAdded.push(...(added || []));
        allModified.push(...(modified || []));
        allRemoved.push(...(removed || []));
        for (const account of accounts ?? []) {
          accountsById.set(account.account_id, account);
        }

        // If this is the first page and has_more is true, track the original cursor
        if (originalCursor === null && has_more && next_cursor) {
          originalCursor = next_cursor;
        }

        // Keep the last page's cursor and update status
        nextCursor = next_cursor ?? null;
        transactionsUpdateStatus = transactions_update_status;

        // If no more pages, break
        if (!has_more) {
          break;
        }
      }

      return {
        added: allAdded,
        modified: allModified,
        removed: allRemoved,
        accounts: [...accountsById.values()],
        nextCursor,
        /**
         * How far Plaid's pull for the item has got, as of the last page:
         * HISTORICAL_UPDATE_COMPLETE once all of its history is loaded.
         */
        transactionsUpdateStatus,
      };
    } catch (error) {
      // If pagination fails, Plaid docs say to restart from original cursor
      // But for now, we'll just throw the error and let the caller handle retry logic
      throw handlePlaidError(error);
    }
  }
}

// Export singleton instance
export const plaidGateway = new PlaidGateway(plaidClient);
