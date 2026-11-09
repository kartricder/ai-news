CREATE TABLE "AiAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY, "articleId" TEXT, "repoId" TEXT, "requestId" TEXT,
  "requestedModel" TEXT NOT NULL, "model" TEXT NOT NULL DEFAULT '', "provider" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'reserved', "errorCode" TEXT NOT NULL DEFAULT '', "latencyMs" INTEGER NOT NULL DEFAULT 0,
  "inputTokens" INTEGER, "outputTokens" INTEGER, "actualUsd" REAL, "promptVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AiAttempt_articleId_createdAt_idx" ON "AiAttempt"("articleId", "createdAt");
CREATE INDEX "AiAttempt_repoId_createdAt_idx" ON "AiAttempt"("repoId", "createdAt");