/**
 * Run all crawlers and save articles to the database.
 * Usage: npx tsx scripts/run-crawl.ts
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
  console.log(`This run  → published: ${result.total.published}, pending: ${result.total.pending}, rejected: ${result.total.rejected}`);
  console.log(`In DB now → published: ${published}, pending: ${pending}, rejected: ${rejected}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Crawl failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
