import { runCrawlPipeline } from '@/lib/pipeline/crawlPipeline';

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
  const result = await runCrawlPipeline();
  return {
    runId: result.runId,
    total: {
      fetched: result.fetched,
      published: result.published,
      pending: result.pending,
      rejected: result.rejected,
      duplicates: result.duplicates,
      errors: result.errors,
    },
    details: {
      pipeline: {
        fetched: result.fetched,
        published: result.published,
        pending: result.pending,
        rejected: result.rejected,
        duplicates: result.duplicates,
        errors: result.errors,
      },
    },
  };
}
