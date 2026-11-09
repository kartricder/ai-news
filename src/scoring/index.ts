import { normalizeNews } from '@/lib/news/normalize';
import { scoreNews } from '@/lib/news/rank';
import type { SourceKind } from '@/lib/news/types';

interface ScoreContext {
  sourceName: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  originalPublishedAt?: Date;
  sourceKind?: SourceKind;
  clock?: Date;
}

export function calculateScore(context: ScoreContext): { score: number; reasons: string[] } {
  const clock = context.clock || new Date();
  const item = normalizeNews({
    sourceId: context.sourceName, sourceUrl: '', articleUrl: '', title: context.title, text: context.content,
    publishedAt: context.originalPublishedAt && Number.isFinite(context.originalPublishedAt.getTime()) ? context.originalPublishedAt.toISOString() : null,
    fetchedAt: clock.toISOString(), language: null, evidenceLevel: 'snippet', tags: context.tags,
  });
  const result = scoreNews(item, { clock, sourceKind: context.sourceKind || 'media' });
  return { score: result.total, reasons: result.reasons };
}