// Client exports
export {
  default as plaid,
  plaidClient,
  type JWKPublicKey,
  type RemovedTransaction,
} from "./client/plaid.js";
export { default as prisma } from "./client/prisma.js";
// Re-export the Prisma client class + namespace so black-box test suites can
// open their OWN connection to an isolated test database (see the service-api
// tests' db helper) without depending on @prisma/client's generated output
// location directly.
export { Prisma, PrismaClient } from "@prisma/client";

// Service exports
export * from "./services/bankAccountService.js";
export * from "./services/itemService.js";
export * from "./services/linkSessionService.js";
export * from "./services/plaidService.js";
export * from "./services/transactionService.js";
export * from "./services/userService.js";

// Type exports (DTOs)
export * from "./types/dto/index.js";

// Util exports
export * from "./utils/errors.js";
export * from "./utils/logger.js";
export * from "./utils/plaidErrors.js";

// Config export
export { default as config } from "./config/default.js";

// Middleware exports
export { requestIdMiddleware } from "./middleware/requestId.js";
export { requestLogger } from "./middleware/requestLogger.js";
