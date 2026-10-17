-- CreateTable
CREATE TABLE "webhook_event" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'plaid',
    "jobId" TEXT NOT NULL,
    "webhookType" TEXT NOT NULL,
    "webhookCode" TEXT NOT NULL,
    "plaidItemId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "replayedAt" TIMESTAMP(3),

    CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_event_plaidItemId_receivedAt_idx" ON "webhook_event"("plaidItemId", "receivedAt");

-- CreateIndex
CREATE INDEX "webhook_event_status_receivedAt_idx" ON "webhook_event"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "webhook_event_receivedAt_idx" ON "webhook_event"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_event_jobId_receivedAt_key" ON "webhook_event"("jobId", "receivedAt");
