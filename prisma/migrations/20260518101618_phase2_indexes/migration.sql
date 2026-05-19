-- CreateIndex
CREATE INDEX "Article_sourceUrl_idx" ON "Article"("sourceUrl");

-- CreateIndex
CREATE INDEX "Article_originalUrl_idx" ON "Article"("originalUrl");

-- CreateIndex
CREATE INDEX "Article_contentHash_idx" ON "Article"("contentHash");
