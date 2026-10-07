// Client exports
export {
  default as plaid,
  plaidClient,
  type JWKPublicKey,
  type RemovedTransaction,
} from "./client/plaid.js";
export { default as prisma } from "./client/prisma.js";
export { Prisma, PrismaClient } from "@prisma/client";

// Service exports
export * from "./repositories/accountRepository.js";
export * from "./repositories/itemRepository.js";
export * from "./repositories/liabilityRepository.js";
export * from "./repositories/linkSessionRepository.js";
export * from "./services/plaidService.js";
export * from "./repositories/transactionRepository.js";
export * from "./repositories/userRepository.js";

// Sync exports
export * from "./sync/index.js";

// Type exports (DTOs)
export * from "./types/dto/index.js";

// Util exports
export * from "./utils/errors.js";
export * from "./utils/logger.js";
export * from "./utils/plaidErrors.js";

// Config export
export { default as config } from "./config/default.js";

// Middleware exports
export { errorHandler } from "./middleware/errorHandler.js";
export { requestIdMiddleware } from "./middleware/requestId.js";
export { requestLogger } from "./middleware/requestLogger.js";
