/**
 * Run all crawlers and save articles to the database.
 * Usage: npm run crawl
 */

import 'dotenv/config';
import { runCrawlPipeline } from '../src/lib/pipeline/crawlPipeline';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('=== Starting full crawl ===\n');
  const result = await runCrawlPipeline();

  const published = await prisma.article.count({ where: { status: 'published' } });
  const pending = await prisma.article.count({ where: { status: 'pending' } });
  const rejected = await prisma.article.count({ where: { status: 'rejected' } });

  console.log('\n=== Crawl summary ===');
  console.log(`Run ID: ${result.runId}`);
  console.log(`This run -> fetched: ${result.fetched}, candidates: ${result.candidates}, published: ${result.published}, pending: ${result.pending}, rejected: ${result.rejected}, duplicates: ${result.duplicates}`);
  if (result.errors.length > 0) {
    console.log(`Errors: ${result.errors.length}`);
    for (const error of result.errors) console.log(`- ${error}`);
  }
  console.log(`In DB now -> published: ${published}, pending: ${pending}, rejected: ${rejected}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Crawl failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
