ALTER TABLE "Article" ADD COLUMN "originalText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "originalLanguage" TEXT;
ALTER TABLE "Article" ADD COLUMN "evidenceLevel" TEXT NOT NULL DEFAULT 'title_only';
ALTER TABLE "Article" ADD COLUMN "qualityFlags" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Article" ADD COLUMN "processingReason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "eventKey" TEXT;
ALTER TABLE "Article" ADD COLUMN "externalVersion" TEXT;