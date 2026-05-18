-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summaryVi" TEXT NOT NULL,
    "contentVi" TEXT NOT NULL DEFAULT '',
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "originalTitle" TEXT NOT NULL DEFAULT '',
    "originalPublishedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "category" TEXT NOT NULL DEFAULT 'general',
    "tags" TEXT NOT NULL DEFAULT '',
    "importanceScore" INTEGER NOT NULL DEFAULT 0,
    "reasonForScore" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "telegramSent" BOOLEAN NOT NULL DEFAULT false,
    "contentHash" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CrawlRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'running',
    "totalFetched" INTEGER NOT NULL DEFAULT 0,
    "totalPublished" INTEGER NOT NULL DEFAULT 0,
    "totalRejected" INTEGER NOT NULL DEFAULT 0,
    "totalPending" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TelegramLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "chatIdMasked" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_status_idx" ON "Article"("status");

-- CreateIndex
CREATE INDEX "Article_importanceScore_idx" ON "Article"("importanceScore");

-- CreateIndex
CREATE INDEX "Article_sourceName_idx" ON "Article"("sourceName");

-- CreateIndex
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt");

-- CreateIndex
CREATE INDEX "Article_slug_idx" ON "Article"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Source_name_key" ON "Source"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");
