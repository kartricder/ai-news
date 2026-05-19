import { HackerNewsCrawler } from './HackerNewsCrawler';
import { RedditCrawler } from './RedditCrawler';
import { GitHubTrendingCrawler } from './GitHubTrendingCrawler';
import { RSSCrawler } from './RSSCrawler';
import { startCrawlRun, finishCrawlRun } from '@/lib/crawlRun';
import { notifyNewArticles } from '@/lib/telegram';

export type CrawlerStats = {
  fetched: number;
  published: number;
  pending: number;
  rejected: number;
  duplicates: number;
  errors: string[];
};

export async function runAllCrawlers(): Promise<{
  runId: string;
  total: CrawlerStats;
  details: Record<string, CrawlerStats>;
}> {
  const crawlers = [
    new RSSCrawler(),
    new HackerNewsCrawler(),
    new RedditCrawler(),
    new GitHubTrendingCrawler(),
  ];

  const runId = await startCrawlRun();
  const details: Record<string, CrawlerStats> = {};
  const total: CrawlerStats = { fetched: 0, published: 0, pending: 0, rejected: 0, duplicates: 0, errors: [] };
  const publishedArticles: { title: string; url: string; score: number; summary: string }[] = [];

  for (const crawler of crawlers) {
    try {
      console.log(`\n=== Running ${crawler.name} ===`);
      const articles = await crawler.crawl();
      const stats = await crawler.saveToDatabase(articles);

      details[crawler.name] = {
        fetched: stats.fetched,
        published: stats.published,
        pending: stats.pending,
        rejected: stats.rejected,
        duplicates: stats.duplicates,
        errors: stats.errors,
      };

      total.fetched += stats.fetched;
      total.published += stats.published;
      total.pending += stats.pending;
      total.rejected += stats.rejected;
      total.duplicates += stats.duplicates;
      total.errors.push(...stats.errors.map((error) => `${crawler.name}: ${error}`));
      publishedArticles.push(...stats.publishedArticles);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${crawler.name}] Crawl failed:`, message);
      details[crawler.name] = { fetched: 0, published: 0, pending: 0, rejected: 0, duplicates: 0, errors: [message] };
      total.errors.push(`${crawler.name}: ${message}`);
    }
  }

  if (publishedArticles.length > 0) {
    await notifyNewArticles(publishedArticles);
  }

  await finishCrawlRun(runId, {
    totalFetched: total.fetched,
    totalPublished: total.published,
    totalRejected: total.rejected,
    totalPending: total.pending,
    errorMessage: total.errors.length > 0 ? total.errors.join('\n').slice(0, 4000) : undefined,
  });

  console.log('\n=== Crawl Complete ===');
  console.log(`Fetched: ${total.fetched}, Published: ${total.published}, Pending: ${total.pending}, Rejected: ${total.rejected}, Duplicates: ${total.duplicates}`);

  return { runId, total, details };
}
