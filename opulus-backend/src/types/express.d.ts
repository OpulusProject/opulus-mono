import { z } from "zod";

declare global {
  namespace Express {
    interface Request {
      validatedQuery?: z.infer<z.ZodSchema>;
    }
  }
}

export {};

