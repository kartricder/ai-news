ALTER TABLE "Source" ADD COLUMN "catalogId" TEXT;
ALTER TABLE "Source" ADD COLUMN "publisherKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Source" ADD COLUMN "kind" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Source" ADD COLUMN "language" TEXT;
ALTER TABLE "Source" ADD COLUMN "discoveryUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Source" ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE "Source" ADD COLUMN "verifiedAt" DATETIME;
ALTER TABLE "Source" ADD COLUMN "lastAttemptAt" DATETIME;
ALTER TABLE "Source" ADD COLUMN "lastSuccessAt" DATETIME;
ALTER TABLE "Source" ADD COLUMN "lastError" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Source" ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Source" ADD COLUMN "nextAttemptAt" DATETIME;
ALTER TABLE "Source" ADD COLUMN "etag" TEXT;
ALTER TABLE "Source" ADD COLUMN "lastModified" TEXT;
CREATE UNIQUE INDEX "Source_catalogId_key" ON "Source"("catalogId");
CREATE TABLE "SourceFetchLog" (
  "id" TEXT NOT NULL PRIMARY KEY, "runId" TEXT, "sourceId" TEXT NOT NULL,
  "status" TEXT NOT NULL, "fetchedCount" INTEGER NOT NULL DEFAULT 0, "durationMs" INTEGER NOT NULL,
  "httpStatus" INTEGER, "errorCode" TEXT, "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SourceFetchLog_runId_idx" ON "SourceFetchLog"("runId");
CREATE INDEX "SourceFetchLog_sourceId_fetchedAt_idx" ON "SourceFetchLog"("sourceId", "fetchedAt");