-- CreateTable
CREATE TABLE "link_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "eventName" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "itemId" TEXT,
    "plaidLinkSessionId" TEXT,
    "plaidRequestId" TEXT,
    "institutionId" TEXT,
    "institutionName" TEXT,
    "viewName" TEXT,
    "exitStatus" TEXT,
    "errorType" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "link_event_userId_createdAt_idx" ON "link_event"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "link_event_sessionId_idx" ON "link_event"("sessionId");

-- CreateIndex
CREATE INDEX "link_event_plaidLinkSessionId_idx" ON "link_event"("plaidLinkSessionId");

-- AddForeignKey
ALTER TABLE "link_event" ADD CONSTRAINT "link_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_event" ADD CONSTRAINT "link_event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
