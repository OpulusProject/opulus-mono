// Client exports
export {
  default as plaid,
  plaidClient,
  type JWKPublicKey,
  type RemovedTransaction,
} from "./client/plaid.js";
export { default as prisma } from "./client/prisma.js";
export { runInTransaction } from "./client/transaction.js";
export { Prisma, PrismaClient } from "@prisma/client";

// Repository exports (data access)
export * from "./repositories/accountRepository.js";
export * from "./repositories/itemRepository.js";
export * from "./repositories/liabilityRepository.js";
export * from "./repositories/linkSessionRepository.js";
export * from "./repositories/transactionRepository.js";
export * from "./repositories/userRepository.js";

// Gateway exports (external APIs)
export * from "./gateways/plaidGateway.js";

// Service exports (business logic shared by the backend and webhooks)
export * from "./services/syncItemLiabilities.js";
export * from "./services/syncItemTransactions.js";

// Type exports (DTOs)
export * from "./types/dto/index.js";

// Util exports
export * from "./utils/errors.js";
export * from "./utils/itemTokenCrypto.js";
export * from "./utils/logger.js";
export * from "./utils/plaidErrors.js";

// Config export
export { default as config } from "./config/default.js";

// Middleware exports
export { errorHandler } from "./middleware/errorHandler.js";
export { requestIdMiddleware } from "./middleware/requestId.js";
export { requestLogger } from "./middleware/requestLogger.js";
