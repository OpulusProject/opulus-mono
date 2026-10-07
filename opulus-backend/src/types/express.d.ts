import { z } from "zod";

declare global {
  namespace Express {
    interface Request {
      validatedBody?: z.infer<z.ZodSchema>;
      validatedQuery?: z.infer<z.ZodSchema>;
    }
  }
}

export {};

