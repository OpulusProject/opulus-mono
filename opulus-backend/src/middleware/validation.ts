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

      // Replace req.body with validated data (type-safe)
      req.body = validationResult.data as z.infer<T>;

      // Continue to next middleware/controller
      next();
    } catch (error) {
      // Pass validation errors to error handler
      next(error);
    }
  };
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
