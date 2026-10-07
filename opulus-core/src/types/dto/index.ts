/**
 * DTO (Data Transfer Object) exports
 * These types are the API contract between the backend and the frontend.
 * Organized by resource, with a file per endpoint.
 *
 * Conventions:
 * - Each DTO is a zod schema (`<Name>DTOSchema`, `<Name>ResponseSchema`,
 *   `<Name>RequestSchema`) with its type inferred from it (`z.infer`), so the
 *   shape is defined once. The service tests parse real responses with the
 *   schemas, and the backend validates request bodies with the same ones.
 * - Entities are named `<Name>DTO` (never the bare Prisma model name, which is
 *   a different thing), and endpoint envelopes `<Name>Response`.
 * - Rows are turned into DTOs by a `to<Name>DTO` function that copies fields
 *   one by one. That list is the allow-list: a new column is never exposed
 *   until it is added here.
 * - JSON has no decimals or dates, so DTOs use numbers (`toNumber`) and ISO
 *   strings (`toIsoString`), both in `common.ts`.
 * - Controllers type `res` as `Response<<Name>Response>` so the compiler checks
 *   what they send against the DTO.
 */

export * from './accounts/index.js';
export * from './auth/index.js';
export * from './common.js';
export * from './institutions/index.js';
export * from './items/index.js';
export * from './linkTokens/index.js';
export * from './transactions/index.js';

