import { ValidationError } from "@opulus/core";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import {
  getValidatedBody,
  getValidatedQuery,
  validate,
  validateQuery,
} from "../../../opulus-backend/src/middleware/validation.js";

type Middleware = ReturnType<typeof validate>;
type Request = Parameters<Middleware>[0];
type Response = Parameters<Middleware>[1];
type NextFunction = Parameters<Middleware>[2];

const schema = z.object({ name: z.string().min(1), count: z.coerce.number().int().default(1) });

/** Run a validation middleware on a fake request, and return what it did with it. */
async function run(middleware: (req: Request, res: Response, next: NextFunction) => unknown, request: Partial<Request>) {
  const req = request as Request;
  const calls: unknown[][] = [];
  await middleware(req, {} as Response, ((...args: unknown[]) => calls.push(args)) as NextFunction);
  return { req, calls };
}

/**
 * Request validation (opulus-backend/src/middleware/validation.ts): the body
 * and query parameters are parsed once by a schema, and the controller reads
 * the parsed result.
 *
 * Test cases:
 * - validate hands the parsed body to the controller, with the schema's defaults and coercions applied
 * - validate refuses a bad body with a ValidationError that names each field
 * - validateQuery parses the query into its own property and leaves req.query alone
 * - validateQuery refuses bad query parameters with a ValidationError that names each field
 * - reading the validated body or query without the middleware is an error that says what is missing
 */
test.describe("request validation", () => {
  test("validate hands the parsed body to the controller, with the schema's defaults and coercions applied", async () => {
    const { req, calls } = await run(validate(schema), { body: { name: "x", count: "3" } });

    expect(calls).toEqual([[]]);
    expect(getValidatedBody<typeof schema>(req)).toEqual({ name: "x", count: 3 });
    expect(req.body).toEqual({ name: "x", count: 3 });
    expect((await run(validate(schema), { body: { name: "y" } })).req.validatedBody).toEqual({ name: "y", count: 1 });
  });

  test("validate refuses a bad body with a ValidationError that names each field", async () => {
    const { calls } = await run(validate(schema), { body: { name: "", count: "not a number" } });

    const [[error]] = calls as [[ValidationError]];
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.statusCode).toBe(400);
    expect(error.details?.map((d) => d.field).sort()).toEqual(["count", "name"]);
  });

  test("validateQuery parses the query into its own property and leaves req.query alone", async () => {
    const query = { name: "x", count: "2" };
    const { req, calls } = await run(validateQuery(schema), { query });

    expect(calls).toEqual([[]]);
    expect(getValidatedQuery<typeof schema>(req)).toEqual({ name: "x", count: 2 });
    expect(req.query).toBe(query);
  });

  test("validateQuery refuses bad query parameters with a ValidationError that names each field", async () => {
    const { calls } = await run(validateQuery(schema), { query: {} });

    const [[error]] = calls as [[ValidationError]];
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe("Invalid query parameters");
    expect(error.details?.[0]?.field).toBe("name");
  });

  test("reading the validated body or query without the middleware is an error that says what is missing", () => {
    expect(() => getValidatedBody({} as Request)).toThrow("validate middleware must run");
    expect(() => getValidatedQuery({} as Request)).toThrow("validateQuery middleware must run");
  });
});
