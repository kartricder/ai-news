import cron, { type ScheduledTask } from 'node-cron';
import { runAllCrawlers } from '@/crawlers';
import { getSetting, setSetting } from '@/lib/settings';
import { postDailySummary, notifyError } from '@/lib/telegram';

const globalScheduler = globalThis as unknown as {
  aiNewsSchedulerTask?: ScheduledTask | null;
};

if (globalScheduler.aiNewsSchedulerTask === undefined) {
  globalScheduler.aiNewsSchedulerTask = null;
}

export async function runScheduler(): Promise<void> {
  console.log(`[Scheduler] Starting crawl at ${new Date().toISOString()}`);

  try {
    const result = await runAllCrawlers();

    const lastDailySummary = await getSetting('last_daily_summary');
    const today = new Date().toISOString().split('T')[0];
    if (!lastDailySummary || !lastDailySummary.startsWith(today)) {
      await postDailySummary({
        totalArticles: result.total.fetched,
        published: result.total.published,
        pending: result.total.pending,
        rejected: result.total.rejected,
        sources: Object.keys(result.details),
      });
      await setSetting('last_daily_summary', today);
    }

    console.log('[Scheduler] Crawl completed.');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Scheduler] Error:', errorMsg);
    await notifyError('Scheduler', errorMsg);
  }
}

export async function startScheduler(cronExpression?: string): Promise<void> {
  if (globalScheduler.aiNewsSchedulerTask) {
    console.warn('[Scheduler] Already running.');
    return;
  }

  const expression =
    cronExpression ||
    (await getSetting('cron_schedule')) ||
    process.env.CRON_SCHEDULE ||
    '0 6 * * *';

  console.log(`[Scheduler] Starting with cron: ${expression}`);
  globalScheduler.aiNewsSchedulerTask = cron.schedule(expression, async () => {
    await runScheduler();
  });
}

export function stopScheduler(): void {
  if (globalScheduler.aiNewsSchedulerTask) {
    globalScheduler.aiNewsSchedulerTask.stop();
    globalScheduler.aiNewsSchedulerTask = null;
    console.log('[Scheduler] Stopped.');
  }
}
