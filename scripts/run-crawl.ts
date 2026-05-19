/**
 * Run all crawlers and save articles to the database.
 * Usage: npm run crawl
 */

import 'dotenv/config';
import { runAllCrawlers } from '../src/crawlers/index';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('=== Starting full crawl ===\n');
  const result = await runAllCrawlers();

  const published = await prisma.article.count({ where: { status: 'published' } });
  const pending = await prisma.article.count({ where: { status: 'pending' } });
  const rejected = await prisma.article.count({ where: { status: 'rejected' } });

  console.log('\n=== Crawl summary ===');
  console.log(`Run ID: ${result.runId}`);
  console.log(`This run -> fetched: ${result.total.fetched}, published: ${result.total.published}, pending: ${result.total.pending}, rejected: ${result.total.rejected}, duplicates: ${result.total.duplicates}`);
  if (result.total.errors.length > 0) {
    console.log(`Errors: ${result.total.errors.length}`);
    for (const error of result.total.errors) console.log(`- ${error}`);
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
