# Observability Implementation

## Stack Decision
- **Logger**: Pino (structured JSON logging)
- **Telemetry**: OpenTelemetry (metrics, traces, log collection)
- **Platform**: Grafana Cloud (free tier)

## Implementation Phases

### Phase 1: Structured Logging (Day 1) ✅
- [x] Add Pino logger to `@opulus/core` (installed pino + pino-pretty)
- [x] Create logger instance with config (`src/utils/logger.ts`)
- [x] Add request ID middleware (`opulus-webhooks/src/middleware/requestId.ts`)
- [x] Replace `console.log` in webhooks service
- [x] Document logging patterns (see below)

### Phase 2: Metrics (Day 2)
- [ ] Add OpenTelemetry SDK
- [ ] Instrument key operations
- [ ] Track webhook metrics
- [ ] Send to Grafana Cloud

### Phase 3: Dashboards (Day 3)
- [ ] Set up Grafana Cloud
- [ ] Create dashboards
- [ ] Set up alerts

## Package Structure Decision
**Decision**: Add logger to `@opulus/core/src/utils/logger.ts`
- Logger is shared infrastructure (like errors.ts)
- Simpler than separate package
- Consistent with existing utils pattern

## Logging Pattern

### Rules (Always Follow)
1. **Log at boundaries** - Entry (function start), Exit (function end), Errors (always)
2. **Log state changes** - When data is created/updated/deleted
3. **Include context** - request_id, job_id, handler name, webhook_code
4. **Use helper functions** - `logHandlerEntry`, `logHandlerExit`, `logHandlerError`, `logStateChange`

### Where to Log

**HTTP Entry Point** (`handlePlaidWebhook.ts`)
- Log webhook received with request_id
- Log webhook enqueued with job_id

**Queue Worker** (`webhookQueue.ts`)
- Log job processing started (with attempt number)
- Log job completed/failed (with duration)

**Handler Router** (`handleLinkWebhook.ts`, `handleItemWebhook.ts`, etc.)
- Log routing decision (DEBUG level)

**Specific Handlers** (e.g., `createItemHandler.ts`)
- Entry: Use `logHandlerEntry(handlerName, webhookCode, context)`
- State changes: Use `logStateChange(handlerName, operation, context)`
- Exit (success): Use `logHandlerExit(handlerName, webhookCode, durationMs, context)`
- Exit (error): Use `logHandlerError(handlerName, webhookCode, error, durationMs, context)`

### Example Handler Pattern

```typescript
export async function handlerName(event: PlaidWebhookEvent) {
  const startTime = Date.now();
  const handlerName = "handlerName";
  const webhookCode = event.webhook_code;

  // Entry
  logHandlerEntry(handlerName, webhookCode, { /* context */ });

  try {
    // ... business logic ...

    // State change (if applicable)
    logStateChange(handlerName, "operation_name", { /* context */ });

    // Exit (success)
    logHandlerExit(handlerName, webhookCode, Date.now() - startTime, { /* context */ });
  } catch (error) {
    // Exit (error)
    logHandlerError(handlerName, webhookCode, error, Date.now() - startTime, { /* context */ });
    throw error;
  }
}
```

### Log Levels
- **INFO**: Entry/exit, state changes, important operations
- **DEBUG**: Routing decisions, intermediate steps
- **WARN**: Recoverable issues, unhandled cases
- **ERROR**: Failures, exceptions, critical issues

