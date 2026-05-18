import cron, { type ScheduledTask } from 'node-cron';
import { runAllCrawlers } from '@/crawlers';
import { getSetting, setSetting } from '@/lib/settings';
import { notifyNewArticles, postDailySummary, notifyError } from '@/lib/telegram';
import { startCrawlRun, finishCrawlRun } from '@/lib/crawlRun';
import { prisma } from '@/lib/prisma';

let schedulerTask: ScheduledTask | null = null;

/**
 * Get all published articles from the last run.
 */
async function getNewlyPublishedArticles() {
  try {
    const articles = await prisma.article.findMany({
      where: {
        status: 'published',
        publishedAt: {
          gte: new Date(Date.now() - 25 * 60 * 60 * 1000), // last 25 hours
        },
      },
      orderBy: { importanceScore: 'desc' },
      take: 20,
    });

    return articles.map((a: any) => ({
      title: a.originalTitle || a.title,
      url: a.originalUrl || a.sourceUrl,
      score: a.importanceScore,
      summary: a.summaryVi,
    }));
  } catch (error) {
    console.error('[Scheduler] Error fetching new articles:', error);
    return [];
  }
}

/**
 * Run the full crawl pipeline.
 */
export async function runScheduler(): Promise<void> {
  console.log('\n========================================');
  console.log(`[Scheduler] Starting crawl at ${new Date().toISOString()}`);
  console.log('========================================\n');

  const crawlRunId = await startCrawlRun();
  const sources: string[] = [];
  let hasError = false;

  try {
    const result = await runAllCrawlers();

    sources.push('RSS', 'Hacker News', 'Reddit', 'GitHub Trending');

    // Send notifications for new articles
    const newArticles = await getNewlyPublishedArticles();
    if (newArticles.length > 0) {
      await notifyNewArticles(newArticles);
    }

    // Daily summary (only once per day)
    const lastDailySummary = await getSetting('last_daily_summary');
    const today = new Date().toISOString().split('T')[0];
    if (!lastDailySummary || !lastDailySummary.startsWith(today)) {
      const totalArticles =
        result.total.published + result.total.pending + result.total.rejected;

      await postDailySummary({
        totalArticles,
        published: result.total.published,
        pending: result.total.pending,
        rejected: result.total.rejected,
        sources,
      });

      await setSetting('last_daily_summary', today);
    }

    const totalFetched =
      result.total.published + result.total.pending + result.total.rejected;

    await finishCrawlRun(crawlRunId, {
      totalFetched,
      totalPublished: result.total.published,
      totalRejected: result.total.rejected,
      totalPending: result.total.pending,
    });
    console.log('[Scheduler] Crawl completed successfully.');
  } catch (err) {
    hasError = true;
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Scheduler] Error:', errorMsg);
    await finishCrawlRun(crawlRunId, {
      totalFetched: 0,
      totalPublished: 0,
      totalRejected: 0,
      totalPending: 0,
      errorMessage: errorMsg,
    });

    await notifyError('Scheduler', errorMsg);
  }
}

/**
 * Start the cron scheduler.
 * Default: runs every day at 6:00, 12:00, 18:00, 0:00.
 */
export function startScheduler(cronExpression?: string): void {
  if (schedulerTask) {
    console.warn('[Scheduler] Already running. Stopping first.');
    stopScheduler();
  }

  const expression = cronExpression || '0 0,6,12,18 * * *'; // 4 times daily
  console.log(`[Scheduler] Starting with cron: ${expression}`);

  schedulerTask = cron.schedule(expression, async () => {
    await runScheduler();
  });

  console.log('[Scheduler] Started.');
}

/**
 * Stop the cron scheduler.
 */
export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('[Scheduler] Stopped.');
  }
}
