import BaseSourceCrawler from './BaseSourceCrawler';
import { prisma } from '@/lib/prisma';
import { toSourceConfig, type SourceProbeResult, type SourceType } from '@/lib/sources/catalog';
import { fetchSource } from '@/lib/sources/reader';
import { recordSourceResult } from '@/lib/sources/health';
import type { ArticleData } from '@/types';

export class ConfiguredSourceCrawler extends BaseSourceCrawler {
  runId?: string;
  checkpoints: { source: { id: string; url: string; configJson: string }; result: SourceProbeResult }[] = [];
  constructor(public sourceType: SourceType, public name: string) { super(); }

  async fetch(): Promise<ArticleData[]> {
    this.checkpoints = [];
    const articles: ArticleData[] = [];
    const sources = await prisma.source.findMany({ where: { type: this.sourceType, enabled: true }, orderBy: { name: 'asc' } });
    for (const source of sources) {
      let result: SourceProbeResult;
      try {
        const config = toSourceConfig(source);
        const now = Date.now();
        if (source.nextAttemptAt && source.nextAttemptAt.getTime() > now) continue;
        const interval = Math.max(this.sourceType === 'arxiv' ? 1440 : 1, config.intervalMinutes);
        if (!source.consecutiveFailures && source.lastAttemptAt && now - source.lastAttemptAt.getTime() < interval * 60_000) continue;
        result = await fetchSource(config);
        if (result.status === 'ok') {
          this.checkpoints.push({ source, result });
          for (const item of result.items) articles.push({
            newsItem: item, sourceId: source.id, externalId: item.externalId,
            publisherKey: config.publisherKey, sourceKind: config.kind, originalText: item.text,
            title: item.title, originalTitle: item.title, originalUrl: item.articleUrl, sourceUrl: item.sourceUrl,
            sourceName: source.name, summaryVi: '', contentVi: '', contentHash: '', slug: '', category: item.category || 'general',
            originalPublishedAt: item.publishedAt && Number.isFinite(Date.parse(item.publishedAt)) ? new Date(item.publishedAt) : undefined,
            tags: item.tags || [], importanceScore: 0, reasonForScore: '', status: 'pending',
          });
        }
      } catch {
        result = { sourceId: source.id, status: 'failed', items: [], samples: [], fetchedAt: new Date().toISOString(), durationMs: 0,
          verificationStatus: 'failed', stale: false, errorCode: 'invalid-source-config' };
      }
      try { await recordSourceResult(source.id, result, this.runId, false, source); }
      catch { this.recordError(`${source.name}: health-write-failed`); }
      if (result.status === 'failed') this.recordError(`${source.name}: ${result.errorCode}`);
    }
    return articles;
  }
}