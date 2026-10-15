import { z } from "zod";

declare global {
  namespace Express {
    interface Request {
      validatedBody?: z.infer<z.ZodType>;
      validatedQuery?: z.infer<z.ZodType>;
    }
  }
}

export {};

