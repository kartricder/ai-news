/**
 * Direct crawl script — run all crawlers and log every article's sourceName
 * to verify the fix: each article must have sourceName that matches a DB seed source.
 *
 * Usage: npx tsx scripts/crawl-direct.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import { RSSCrawler } from '../src/crawlers/RSSCrawler';
import { RedditCrawler } from '../src/crawlers/RedditCrawler';
// GitHubTrendingCrawler & HackerNewsCrawler need env keys; uncomment when available
// import { GitHubTrendingCrawler } from '../src/crawlers/GitHubTrendingCrawler';
// import { HackerNewsCrawler } from '../src/crawlers/HackerNewsCrawler';

const DB_SOURCE_NAMES = [
  'OpenAI Blog',
  'Anthropic Blog',
  'Google AI Blog',
  'Meta AI Blog',
  'DeepMind Blog',
  'GitHub Trending',
  'Hacker News',
  'Reddit r/LocalLLaMA',
  'Reddit r/MachineLearning',
  'Reddit r/OpenAI',
];

async function main() {
  // Initialize PrismaClient with adapter for better-sqlite3 (Prisma v7.x)
  const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
  console.log(`DB path: ${dbPath}`);
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });

  // 1. Show DB sources
  const dbSources = await prisma.source.findMany();
  console.log('=== DB Sources (' + dbSources.length + ') ===');
  for (const s of dbSources) {
    console.log(`  [${s.id}] name="${s.name}" type=${s.type}`);
  }
  console.log();

  // 2. Run each crawler individually and log output
  const crawlers = [
    { name: 'RSS', instance: new RSSCrawler() },
    // GitHub & HackerNews may need env keys; uncomment when available
    // { name: 'GitHub Trending', instance: new GitHubTrendingCrawler() },
    // { name: 'HackerNews', instance: new HackerNewsCrawler() },
    { name: 'Reddit', instance: new RedditCrawler() },
  ];

  for (const { name, instance } of crawlers) {
    console.log(`\n=== Crawling ${name} ===`);
    try {
      const articles = await instance.fetch();
      console.log(`  Fetched ${articles.length} articles`);

      if (articles.length === 0) {
        console.log('  ⚠️  No articles returned');
        continue;
      }

      let matched = 0;
      let unmatched = 0;
      for (const a of articles) {
        const isMatch = DB_SOURCE_NAMES.includes(a.sourceName);
        if (isMatch) matched++;
        else unmatched++;
        console.log(
          `  ${isMatch ? '✅' : '❌'} sourceName="${a.sourceName}" — title="${a.title.substring(0, 80)}..."`
        );
      }
      console.log(`  Summary: ${matched} matched, ${unmatched} unmatched`);
    } catch (err: any) {
      console.error(`  ❌ Error crawling ${name}:`, err?.message || err);
    }
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
