ALTER TABLE "Article" ADD COLUMN "identityKey" TEXT;
ALTER TABLE "Article" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "Article" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Article" ADD COLUMN "fingerprint" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "pendingFingerprint" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "contentChangedAt" DATETIME;
ALTER TABLE "Article" ADD COLUMN "identityReviewReason" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX "Article_identityKey_key" ON "Article"("identityKey");