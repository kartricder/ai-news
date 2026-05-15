import { HackerNewsCrawler } from './HackerNewsCrawler';
import { RedditCrawler } from './RedditCrawler';
import { GitHubTrendingCrawler } from './GitHubTrendingCrawler';
import { RSSCrawler } from './RSSCrawler';

export type CrawlerStats = {
  published: number;
  pending: number;
  rejected: number;
};

/**
 * Run all crawlers sequentially and collect stats.
 */
export async function runAllCrawlers(): Promise<{
  total: CrawlerStats;
  details: Record<string, CrawlerStats>;
}> {
  const crawlers = [
    new RSSCrawler(),
    new HackerNewsCrawler(),
    new RedditCrawler(),
    new GitHubTrendingCrawler(),
  ];

  const details: Record<string, CrawlerStats> = {};
  const total: CrawlerStats = { published: 0, pending: 0, rejected: 0 };

  for (const crawler of crawlers) {
    try {
      console.log(`\n=== Running ${crawler.name} ===`);
      const stats = await crawler.run();
      details[crawler.name] = stats;
      total.published += stats.published;
      total.pending += stats.pending;
      total.rejected += stats.rejected;
    } catch (err) {
      console.error(`[${crawler.name}] Crawl failed:`, err);
      details[crawler.name] = { published: 0, pending: 0, rejected: 0 };
    }
  }

  console.log('\n=== Crawl Complete ===');
  console.log(`Published: ${total.published}, Pending: ${total.pending}, Rejected: ${total.rejected}`);

  return { total, details };
}
