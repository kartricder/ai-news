import { GitHubTrendingCrawler } from '@/crawlers/GitHubTrendingCrawler';
import { HackerNewsCrawler } from '@/crawlers/HackerNewsCrawler';
import { RedditCrawler } from '@/crawlers/RedditCrawler';
import { RSSCrawler } from '@/crawlers/RSSCrawler';
import type { ConfiguredSourceCrawler } from '@/crawlers/ConfiguredSourceCrawler';
import { ArxivCrawler } from '@/crawlers/ArxivCrawler';
import { GitHubReleaseCrawler } from '@/crawlers/GitHubReleaseCrawler';
import { ArticleData } from '@/types';
import type { processArticleWithAI } from '@/lib/ai/openRouter';
import { startCrawlRun, finishCrawlRun } from '@/lib/crawlRun';
import { prisma } from '@/lib/prisma';
import { getAppSettings } from '@/lib/settings';
import { generateSlug } from '@/lib/utils';
import { getIdentityKey } from '@/lib/news/identity';
import { createIdentityArticle, findIdentityOwner } from '@/lib/news/storeIdentity';
import type { RawNewsItem, RankedCandidate } from '@/lib/news/types';
import { normalizeNews, assessEvidence } from '@/lib/news/normalize';
import { scoreNews, eventTypeFor } from '@/lib/news/rank';
import { eventKeyFor, suggestCluster } from '@/lib/news/cluster';
import { checkpointSourceValidators } from '@/lib/sources/health';
import { enrichCommunityItem } from '@/lib/news/enrich';
import { runRepoRadar } from './repoRadar';
import { processPendingArticles } from './processPending';

export type CrawlPipelineStats = {
  runId: string;
  fetched: number;
  candidates: number;
  published: number;
  pending: number;
  rejected: number;
  duplicates: number;
  aiSuccess: number;
  aiFailed: number;
  telegramSent: number;
  repoRadarFound: number;
  errors: string[];
};

type Candidate = ArticleData & RankedCandidate & {
  canonicalUrl: string;
  identityKey: string | null;
  fingerprint: string;
  pendingFingerprint: string;
  identityReviewReason: string;
  processingReason: string;
};

function toCandidate(article: ArticleData, clock: Date): Candidate {
  const raw: RawNewsItem = article.newsItem || {
    sourceId: article.sourceId || '',
    externalId: article.externalId,
    articleUrl: article.originalUrl,
    sourceUrl: article.sourceUrl,
    title: article.originalTitle || article.title,
    text: article.originalText ?? (article.contentVi || article.summaryVi || ''),
    publishedAt: article.originalPublishedAt && Number.isFinite(article.originalPublishedAt.getTime())
      ? article.originalPublishedAt.toISOString() : null,
    fetchedAt: clock.toISOString(),
    language: null,
    evidenceLevel: 'snippet',
  };
  const item = normalizeNews(raw);
  const identityKey = getIdentityKey(item);
  const fingerprint = item.fingerprint;
  const gate = assessEvidence(item);
  const sourceKind = article.sourceKind || 'media';
  const breakdown = scoreNews(item, { clock, sourceKind });
  return {
    ...article,
    item, breakdown, sourceKind, publisherKey: article.publisherKey || article.sourceName.toLowerCase(), eligibleForAI: gate.eligibleForAI,
    title: item.title, originalTitle: item.title, originalText: item.originalText,
    originalPublishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
    category: item.category, importanceScore: breakdown.total, reasonForScore: breakdown.reasons.join('; '),
    canonicalUrl: item.canonicalUrl,
    identityKey,
    fingerprint,
    pendingFingerprint: '',
    identityReviewReason: !identityKey ? 'missing-identity' : !item.canonicalUrl ? 'missing-article-url' : '',
    contentHash: fingerprint,
    processingReason: gate.reasons.join('; '),
  };
}

async function fetchCandidates(runId: string, clock: Date): Promise<{ candidates: Candidate[]; fetched: number; errors: string[]; checkpoints: ConfiguredSourceCrawler['checkpoints'] }> {
  const crawlers = [
    new RSSCrawler(),
    new HackerNewsCrawler(),
    new RedditCrawler(),
    new GitHubTrendingCrawler(),
    new ArxivCrawler(),
    new GitHubReleaseCrawler(),
  ];
  const candidates: Candidate[] = [];
  const errors: string[] = [];
  let fetched = 0;
  const enrichmentCache = new Map<string, Promise<string | null>>();
  const checkpoints: ConfiguredSourceCrawler['checkpoints'] = [];

  for (const crawler of crawlers) {
    try {
      console.log(`[Pipeline] Fetching ${crawler.name}`);
      crawler.runId = runId;
      const articles = await crawler.crawl();
      errors.push(...crawler.getErrors());
      checkpoints.push(...crawler.checkpoints);
      fetched += articles.length;
      for (const article of articles) {
        if (['hackernews', 'reddit'].includes(crawler.sourceType) && article.newsItem) {
          article.newsItem = await enrichCommunityItem(article.newsItem, enrichmentCache);
        }
        candidates.push(toCandidate(article, clock));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${crawler.name}: ${message}`);
    }
  }

  return { candidates, fetched, errors, checkpoints };
}

async function dedupeCandidates(candidates: Candidate[]): Promise<{ unique: Candidate[]; duplicates: number; errors: string[] }> {
  const unique: Candidate[] = [];
  const seenUrls = new Map<string, Candidate>();
  let duplicates = 0;

  for (const candidate of candidates) {
    const key = candidate.identityKey;
    const inRunDuplicate = key ? seenUrls.get(key) : undefined;
    if (inRunDuplicate) {
      if (inRunDuplicate.fingerprint !== candidate.fingerprint) {
        inRunDuplicate.identityReviewReason = 'conflicting-content-in-run';
        inRunDuplicate.pendingFingerprint = candidate.fingerprint;
      }
      duplicates++;
      continue;
    }

    const existing = await findIdentityOwner(candidate);
    if (existing) {
      duplicates++;
      continue;
    }

    if (key) seenUrls.set(key, candidate);
    unique.push(candidate);
  }

  return { unique, duplicates, errors: [] };
}

function rankCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((first, second) => second.importanceScore - first.importanceScore || first.fingerprint.localeCompare(second.fingerprint));
}

async function uniqueSlug(baseSlug: string): Promise<string> {
  const cleanBase = baseSlug || generateSlug(`article-${Date.now()}`);
  let slug = cleanBase;
  let suffix = 1;
  while (await prisma.article.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${cleanBase}-${suffix}`;
  }
  return slug;
}

async function createArticle(candidate: Candidate, status: 'pending' | 'published' | 'rejected', ai?: Awaited<ReturnType<typeof processArticleWithAI>>, aiError?: string) {
  const vietnameseOriginal = candidate.item.language?.toLowerCase().startsWith('vi');
  const title = ai?.titleVi || candidate.title;
  const summaryVi = ai?.briefVi || (vietnameseOriginal ? candidate.item.originalText.slice(0, 450) : '');
  const tags = [...new Set([...(candidate.tags || []), ...(ai?.aiTags || [])])].filter(Boolean);
  const slug = await uniqueSlug(generateSlug(title || candidate.title));

  const gate = assessEvidence(candidate.item);
  const guardedStatus = candidate.identityReviewReason || gate.requiresReview ? 'pending' : status;
  const saved = await createIdentityArticle({
      title,
      titleVi: ai?.titleVi || '',
      slug,
      summaryVi,
      briefVi: ai?.briefVi || '',
      whyImportant: ai?.whyImportant || '',
      contentVi: summaryVi,
      sourceName: candidate.sourceName,
      sourceUrl: candidate.sourceUrl,
      originalUrl: candidate.originalUrl,
      originalTitle: candidate.originalTitle || candidate.title,
      originalPublishedAt: candidate.originalPublishedAt || null,
      originalText: candidate.item.originalText,
      originalLanguage: candidate.item.language,
      evidenceLevel: candidate.item.evidenceLevel,
      qualityFlags: JSON.stringify(gate.reasons),
      processingReason: candidate.processingReason,
      processingStatus: candidate.identityReviewReason || gate.requiresReview || !gate.eligibleForAI ? 'review' : 'queued',
      eventKey: eventKeyFor(candidate.item),
      externalVersion: candidate.item.externalVersion,
      scoreVersion: candidate.breakdown.version,
      scoreBreakdown: JSON.stringify(candidate.breakdown),
      publisherKey: candidate.publisherKey,
      sourceKind: candidate.sourceKind,
      fetchedAt: new Date(candidate.item.fetchedAt),
      category: candidate.category,
      tags: tags.join(', '),
      aiTags: (ai?.aiTags || []).join(', '),
      targetAudience: ai?.targetAudience || '',
      impactLevel: ai?.impactLevel || '',
      importanceScore: candidate.importanceScore,
      reasonForScore: candidate.reasonForScore,
      status: guardedStatus,
      aiProvider: ai?.provider || '',
      aiModel: ai?.model || '',
      aiStatus: ai?.status || (aiError ? 'failed' : 'pending'),
      aiError: aiError?.slice(0, 1000) || '',
      aiProcessedAt: ai || aiError ? new Date() : null,
      canonicalUrl: candidate.canonicalUrl,
      identityKey: candidate.identityKey,
      sourceId: candidate.sourceId,
      externalId: candidate.externalId,
      fingerprint: candidate.fingerprint,
      pendingFingerprint: candidate.pendingFingerprint,
      contentChangedAt: candidate.pendingFingerprint ? new Date() : null,
      identityReviewReason: candidate.identityReviewReason,
      publishedAt: guardedStatus === 'published' ? new Date() : null,
      contentHash: candidate.fingerprint,
  });
  const eventKey = eventKeyFor(candidate.item);
  if (saved.created && candidate.item.publishedAt && (eventKey || eventTypeFor(candidate.item) !== 'general')) {
    const clusterKey = eventKey || `review:${saved.article.id}`;
    const cluster = await prisma.newsCluster.upsert({ where: { eventKey: clusterKey }, create: { eventKey: clusterKey }, update: {} });
    const neighbor = eventKey ? await prisma.article.findFirst({ where: { eventKey, id: { not: saved.article.id },
      originalPublishedAt: { gte: new Date(Date.parse(candidate.item.publishedAt) - 72 * 3_600_000), lte: new Date(Date.parse(candidate.item.publishedAt) + 72 * 3_600_000) } } })
      : null;
    const neighborItem = neighbor ? normalizeNews({ sourceId: neighbor.sourceId || '', title: neighbor.originalTitle, text: neighbor.originalText,
      articleUrl: neighbor.originalUrl, sourceUrl: neighbor.sourceUrl, fetchedAt: neighbor.fetchedAt.toISOString(),
      publishedAt: neighbor.originalPublishedAt?.toISOString() || null, evidenceLevel: 'snippet', language: neighbor.originalLanguage,
      eventKey: neighbor.eventKey || undefined, externalVersion: neighbor.externalVersion || undefined }) : null;
    const suggestion = suggestCluster(candidate.item, neighborItem ? [{ clusterId: cluster.id, item: { ...neighborItem, eventKey: candidate.item.eventKey } }] : []);
    await prisma.newsClusterLink.create({ data: { clusterId: cluster.id, articleId: saved.article.id, confidence: suggestion.confidence,
      reasons: JSON.stringify(neighbor ? suggestion.reasons : [eventKey ? 'event-anchor' : 'ambiguous-or-insufficient-event-identity', 'requires-editor-review']), status: 'suggested' } });
  }
  return saved;
}

export async function runCrawlPipeline(): Promise<CrawlPipelineStats> {
  const settings = await getAppSettings();
  const clock = new Date();
  const runId = await startCrawlRun();
  const stats: CrawlPipelineStats = {
    runId,
    fetched: 0,
    candidates: 0,
    published: 0,
    pending: 0,
    rejected: 0,
    duplicates: 0,
    aiSuccess: 0,
    aiFailed: 0,
    telegramSent: 0,
    repoRadarFound: 0,
    errors: [],
  };

  try {
    console.log(`[Pipeline] Crawl run ${runId} started`);
    const fetched = await fetchCandidates(runId, clock);
    stats.fetched = fetched.fetched;
    stats.errors.push(...fetched.errors);

    const deduped = await dedupeCandidates(fetched.candidates);
    stats.candidates = deduped.unique.length;
    stats.duplicates = deduped.duplicates;
    stats.errors.push(...deduped.errors);

    const ranked = rankCandidates(deduped.unique);
    const newArticleIds: string[] = [];
    for (const candidate of ranked) {
      candidate.processingReason ||= candidate.identityReviewReason || (candidate.importanceScore < settings.pending_threshold ? 'below-review-threshold' : 'queued-pending-selection');
      const saved = await createArticle(candidate, 'pending');
      if (!saved.created) stats.duplicates++;
      else { stats.pending++; newArticleIds.push(saved.article.id); }
    }

    if (ranked.length === 0) {
      console.log('[Pipeline] No publishable candidates found; crawl still completed');
    }

    for (const checkpoint of fetched.checkpoints) await checkpointSourceValidators(checkpoint.source, checkpoint.result);

    const processed = await processPendingArticles({ limit: 10, dryRun: false });
    stats.published += processed.published;
    stats.aiSuccess += processed.aiSuccess;
    stats.aiFailed += processed.aiFailed;
    stats.pending = newArticleIds.length ? await prisma.article.count({ where: { id: { in: newArticleIds }, status: 'pending' } }) : 0;
    stats.telegramSent += processed.telegramSent;
    stats.errors.push(...processed.errors);
    const repoRadar = await runRepoRadar(Math.min(10, settings.max_repo_radar_ai_per_crawl));
    stats.repoRadarFound = repoRadar.found;
    stats.aiSuccess += repoRadar.aiSuccess;
    stats.aiFailed += repoRadar.aiFailed;
    stats.errors.push(...repoRadar.errors.map((error) => `RepoRadar: ${error}`));

    await finishCrawlRun(runId, {
      totalFetched: stats.fetched,
      totalCandidates: stats.candidates,
      totalPublished: stats.published,
      totalPending: stats.pending,
      totalRejected: stats.rejected,
      totalDuplicates: stats.duplicates,
      aiSuccess: stats.aiSuccess,
      aiFailed: stats.aiFailed,
      telegramSent: stats.telegramSent,
      repoRadarFound: stats.repoRadarFound,
      errorMessage: stats.errors.length ? stats.errors.join('\n').slice(0, 4000) : undefined,
    });

    console.log(`[Pipeline] Completed run ${runId}: published=${stats.published}, pending=${stats.pending}, rejected=${stats.rejected}`);
    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stats.errors.push(message);
    await finishCrawlRun(runId, {
      totalFetched: stats.fetched,
      totalCandidates: stats.candidates,
      totalPublished: stats.published,
      totalPending: stats.pending,
      totalRejected: stats.rejected,
      totalDuplicates: stats.duplicates,
      aiSuccess: stats.aiSuccess,
      aiFailed: stats.aiFailed,
      telegramSent: stats.telegramSent,
      repoRadarFound: stats.repoRadarFound,
      errorMessage: stats.errors.join('\n').slice(0, 4000),
    });
    throw error;
  }
}
