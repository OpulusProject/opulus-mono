// Client exports
export {
  default as plaid,
  plaidClient,
  type JWKPublicKey,
  type RemovedTransaction,
} from "./client/plaid.js";
export { default as prisma } from "./client/prisma.js";
export { checkRedisConnection, redisConnection } from "./client/redis.js";
export { runInTransaction } from "./client/transaction.js";
export { Prisma, PrismaClient } from "@prisma/client";

// Repository exports (data access)
export * from "./repositories/accountRepository.js";
export * from "./repositories/exchangeRateRepository.js";
export * from "./repositories/holdingRepository.js";
export * from "./repositories/investmentTransactionRepository.js";
export * from "./repositories/itemRepository.js";
export * from "./repositories/liabilityRepository.js";
export * from "./repositories/linkEventRepository.js";
export * from "./repositories/linkSessionRepository.js";
export * from "./repositories/transactionRepository.js";
export * from "./repositories/recurringStreamRepository.js";
export * from "./repositories/securityPriceRepository.js";
export * from "./repositories/userRepository.js";
export * from "./repositories/webhookEventRepository.js";

// Gateway exports (external APIs)
export * from "./gateways/activePriceProvider.js";
export * from "./gateways/exchangeRateProvider.js";
export * from "./gateways/frankfurterGateway.js";
export * from "./gateways/plaidGateway.js";
export * from "./gateways/priceProvider.js";
export * from "./gateways/yahooGateway.js";

// Service exports (business logic shared by the backend and webhooks)
export * from "./services/exchangeRateConverter.js";
export * from "./services/refreshExchangeRates.js";
export * from "./services/securityDividends.js";
export * from "./services/securityPrices.js";
export * from "./services/syncItemAccounts.js";
export * from "./services/syncItemHoldings.js";
export * from "./services/syncItemInvestmentTransactions.js";
export * from "./services/syncItemLiabilities.js";
export * from "./services/syncItemRecurring.js";
export * from "./services/syncItemTransactions.js";

// Type exports (DTOs)
export * from "./types/dto/index.js";

// Util exports
export * from "./utils/accounts.js";
export * from "./utils/currency.js";
export * from "./utils/day.js";
export * from "./utils/errors.js";
export * from "./utils/itemTokenCrypto.js";
export * from "./utils/priceProviderName.js";
export * from "./utils/securitySymbol.js";
export * from "./utils/logger.js";
export * from "./utils/money.js";
export * from "./utils/plaidErrors.js";

// Config export
export * from "./config/validate.js";
export { default as config } from "./config/default.js";

// Middleware exports
export { errorHandler } from "./middleware/errorHandler.js";
export { requestIdMiddleware } from "./middleware/requestId.js";
export { requestLogger } from "./middleware/requestLogger.js";
