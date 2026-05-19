-- Phase 3: AI processing metadata, crawl stats, and Repo Radar.
ALTER TABLE "Article" ADD COLUMN "titleVi" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "briefVi" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "whyImportant" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "aiTags" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "targetAudience" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "impactLevel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "aiProvider" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "aiModel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "aiStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Article" ADD COLUMN "aiError" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "aiProcessedAt" DATETIME;
ALTER TABLE "Article" ADD COLUMN "duplicateOfId" TEXT;
ALTER TABLE "Article" ADD COLUMN "duplicateReason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "canonicalUrl" TEXT NOT NULL DEFAULT '';

ALTER TABLE "CrawlRun" ADD COLUMN "totalCandidates" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrawlRun" ADD COLUMN "totalDuplicates" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrawlRun" ADD COLUMN "aiSuccess" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrawlRun" ADD COLUMN "aiFailed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrawlRun" ADD COLUMN "telegramSent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrawlRun" ADD COLUMN "repoRadarFound" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "RepoRadarItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repoName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "watchers" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL DEFAULT '',
    "topics" TEXT NOT NULL DEFAULT '',
    "lastPushedAt" DATETIME,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repoScore" INTEGER NOT NULL DEFAULT 0,
    "aiSummaryVi" TEXT NOT NULL DEFAULT '',
    "whyImportant" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'tracked',
    "aiProvider" TEXT NOT NULL DEFAULT '',
    "aiModel" TEXT NOT NULL DEFAULT '',
    "aiStatus" TEXT NOT NULL DEFAULT 'pending',
    "aiError" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "RepoRadarItem_fullName_key" ON "RepoRadarItem"("fullName");
CREATE INDEX "Article_canonicalUrl_idx" ON "Article"("canonicalUrl");
CREATE INDEX "Article_duplicateOfId_idx" ON "Article"("duplicateOfId");
CREATE INDEX "RepoRadarItem_repoScore_idx" ON "RepoRadarItem"("repoScore");
CREATE INDEX "RepoRadarItem_status_idx" ON "RepoRadarItem"("status");
CREATE INDEX "RepoRadarItem_lastPushedAt_idx" ON "RepoRadarItem"("lastPushedAt");
