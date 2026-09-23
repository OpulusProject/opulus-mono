-- CreateTable
CREATE TABLE "webhook_dead_letter" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "webhookType" TEXT NOT NULL,
    "webhookCode" TEXT NOT NULL,
    "itemId" TEXT,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replayedAt" TIMESTAMP(3),

    CONSTRAINT "webhook_dead_letter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_dead_letter_itemId_idx" ON "webhook_dead_letter"("itemId");

-- CreateIndex
CREATE INDEX "webhook_dead_letter_createdAt_idx" ON "webhook_dead_letter"("createdAt");
