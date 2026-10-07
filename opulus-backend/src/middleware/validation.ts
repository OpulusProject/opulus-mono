import { ValidationError } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z, ZodSchema } from "zod";

/**
 * Validation middleware factory
 * Creates a middleware that validates request body against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * router.post("/register", validate(registerSchema), authController.register);
 */
export function validate<T extends ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body against schema
      const validationResult = schema.safeParse(req.body);

      if (!validationResult.success) {
        throw new ValidationError(
          "Validation failed",
          validationResult.error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          }))
        );
      }

      // Replace req.body with validated data, and keep it for getValidatedBody
      req.body = validationResult.data as z.infer<T>;
      req.validatedBody = validationResult.data as z.infer<T>;

      // Continue to next middleware/controller
      next();
    } catch (error) {
      // Pass validation errors to error handler
      next(error);
    }
  };
}

/**
 * Read the request body that `validate` parsed for this request, so a
 * controller does not parse it a second time.
 *
 * `validate` stores the schema's parsed output, so pass the same schema as the
 * type argument to get its inferred type. This keeps the one type assertion in
 * a single place and fails with a clear error if a route forgot the middleware.
 *
 * @throws Error if `validate` did not run for this request
 *
 * @example
 * const { itemId } = getValidatedBody<typeof refreshTransactionsBodySchema>(req);
 */
export function getValidatedBody<T extends ZodSchema>(
  req: Request
): z.infer<T> {
  if (req.validatedBody === undefined) {
    throw new Error(
      "validate middleware must run before reading the validated request body"
    );
  }
  return req.validatedBody as z.infer<T>;
}

/**
 * Query parameter validation middleware factory
 * Creates a middleware that validates request query parameters against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * router.get("/transactions", validateQuery(transactionsQuerySchema), getTransactionsController);
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request query parameters against schema
      const validationResult = schema.safeParse(req.query);

      if (!validationResult.success) {
        throw new ValidationError(
          "Invalid query parameters",
          validationResult.error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          }))
        );
      }

      // Store validated query data in custom property (req.query is read-only)
      req.validatedQuery = validationResult.data as z.infer<T>;

      // Continue to next middleware/controller
      next();
    } catch (error) {
      // Pass validation errors to error handler
      next(error);
    }
  };
}

/**
 * Read the query parameters that `validateQuery` parsed for this request.
 *
 * `validateQuery` stores the schema's parsed output, so pass the same schema
 * as the type argument to get its inferred type. This keeps the one type
 * assertion in a single place and fails with a clear error, instead of an
 * obscure one, if a route forgot to apply the middleware.
 *
 * @throws Error if `validateQuery` did not run for this request
 *
 * @example
 * const { type } = getValidatedQuery<typeof getAccountsQuerySchema>(req);
 */
export function getValidatedQuery<T extends ZodSchema>(
  req: Request
): z.infer<T> {
  if (req.validatedQuery === undefined) {
    throw new Error(
      "validateQuery middleware must run before reading validated query parameters"
    );
  }
  return req.validatedQuery as z.infer<T>;
}
