ALTER TABLE "Article" ADD COLUMN "scoreVersion" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "scoreBreakdown" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Article" ADD COLUMN "publisherKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "sourceKind" TEXT NOT NULL DEFAULT 'media';
CREATE INDEX "Article_eventKey_originalPublishedAt_idx" ON "Article"("eventKey", "originalPublishedAt");
CREATE TABLE "NewsCluster" (
  "id" TEXT NOT NULL PRIMARY KEY, "eventKey" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "NewsCluster_eventKey_key" ON "NewsCluster"("eventKey");
CREATE TABLE "NewsClusterLink" (
  "id" TEXT NOT NULL PRIMARY KEY, "clusterId" TEXT NOT NULL, "articleId" TEXT NOT NULL,
  "confidence" REAL NOT NULL, "reasons" TEXT NOT NULL DEFAULT '[]', "status" TEXT NOT NULL DEFAULT 'suggested',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "NewsClusterLink_clusterId_articleId_key" ON "NewsClusterLink"("clusterId", "articleId");
CREATE INDEX "NewsClusterLink_articleId_idx" ON "NewsClusterLink"("articleId");