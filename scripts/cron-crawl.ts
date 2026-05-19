import 'dotenv/config';
import { runCrawlPipeline } from '../src/lib/pipeline/crawlPipeline';
import { prisma } from '../src/lib/prisma';

async function main() {
  const startedAt = new Date();
  console.log(`[cron:crawl] started at ${startedAt.toISOString()}`);

  const result = await runCrawlPipeline();
  console.log('[cron:crawl] completed', {
    crawlRunId: result.runId,
    fetched: result.fetched,
    candidates: result.candidates,
    published: result.published,
    pending: result.pending,
    rejected: result.rejected,
    duplicates: result.duplicates,
    aiSuccess: result.aiSuccess,
    aiFailed: result.aiFailed,
    telegramSent: result.telegramSent,
    repoRadarFound: result.repoRadarFound,
  });

  if (result.errors.length > 0) {
    console.log(`[cron:crawl] completed with ${result.errors.length} non-fatal warnings`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[cron:crawl] fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
