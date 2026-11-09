ALTER TABLE "Article" ADD COLUMN "processingStatus" TEXT NOT NULL DEFAULT 'review';
ALTER TABLE "Article" ADD COLUMN "processingAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Article" ADD COLUMN "nextRetryAt" DATETIME;
ALTER TABLE "Article" ADD COLUMN "leaseUntil" DATETIME;
ALTER TABLE "Article" ADD COLUMN "leaseOwner" TEXT;
ALTER TABLE "Article" ADD COLUMN "promptVersion" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "schemaVersion" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "inputHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "aiClaims" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Article" ADD COLUMN "aiUncertainties" TEXT NOT NULL DEFAULT '[]';
CREATE INDEX "Article_status_processingStatus_nextRetryAt_idx" ON "Article"("status", "processingStatus", "nextRetryAt");
ALTER TABLE "RepoRadarItem" ADD COLUMN "processingAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RepoRadarItem" ADD COLUMN "nextRetryAt" DATETIME;
ALTER TABLE "RepoRadarItem" ADD COLUMN "leaseOwner" TEXT;
ALTER TABLE "RepoRadarItem" ADD COLUMN "leaseUntil" DATETIME;
ALTER TABLE "RepoRadarItem" ADD COLUMN "inputHash" TEXT NOT NULL DEFAULT '';
CREATE TABLE "AiBudgetDay" (
  "day" TEXT NOT NULL PRIMARY KEY, "spentMicros" BIGINT NOT NULL DEFAULT 0,
  "reservedMicros" BIGINT NOT NULL DEFAULT 0, "unknownCount" INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE "AiReservation" (
  "id" TEXT NOT NULL PRIMARY KEY, "day" TEXT NOT NULL, "estimatedMicros" BIGINT NOT NULL,
  "actualMicros" BIGINT, "status" TEXT NOT NULL DEFAULT 'reserved', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settledAt" DATETIME
);
CREATE INDEX "AiReservation_day_status_idx" ON "AiReservation"("day", "status");
CREATE TABLE "AiResultCache" (
  "id" TEXT NOT NULL PRIMARY KEY, "articleId" TEXT NOT NULL, "inputHash" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL, "schemaVersion" TEXT NOT NULL, "resultJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AiResultCache_articleId_inputHash_promptVersion_schemaVersion_key" ON "AiResultCache"("articleId", "inputHash", "promptVersion", "schemaVersion");
CREATE TABLE "AdminAudit" (
  "id" TEXT NOT NULL PRIMARY KEY, "actor" TEXT NOT NULL, "action" TEXT NOT NULL, "articleId" TEXT,
  "beforeJson" TEXT NOT NULL, "afterJson" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AdminAudit_articleId_createdAt_idx" ON "AdminAudit"("articleId", "createdAt");
CREATE TABLE "WorkerLease" ("name" TEXT NOT NULL PRIMARY KEY, "owner" TEXT NOT NULL, "leaseUntil" DATETIME NOT NULL);