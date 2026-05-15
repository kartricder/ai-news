import { prisma } from '@/lib/prisma';
import { CrawlRunStatus } from '@prisma/client';

export async function startCrawlRun(): Promise<string> {
  const run = await prisma.crawlRun.create({
    data: {
      startedAt: new Date(),
      status: 'running',
      totalFetched: 0,
      totalPublished: 0,
      totalRejected: 0,
      totalPending: 0,
    },
  });
  return run.id;
}

export async function finishCrawlRun(
  id: string,
  stats: {
    totalFetched: number;
    totalPublished: number;
    totalRejected: number;
    totalPending: number;
    errorMessage?: string;
  }
): Promise<void> {
  await prisma.crawlRun.update({
    where: { id },
    data: {
      ...stats,
      finishedAt: new Date(),
      status: stats.errorMessage ? 'failed' : 'success',
      errorMessage: stats.errorMessage,
    },
  });
}
