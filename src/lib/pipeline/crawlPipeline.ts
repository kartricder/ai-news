import { Article } from '@prisma/client';
import { GitHubTrendingCrawler } from '@/crawlers/GitHubTrendingCrawler';
import { HackerNewsCrawler } from '@/crawlers/HackerNewsCrawler';
import { RedditCrawler } from '@/crawlers/RedditCrawler';
import { RSSCrawler } from '@/crawlers/RSSCrawler';
import { ArticleData } from '@/types';
import { AiProcessingError, processArticleWithAI } from '@/lib/ai/openRouter';
import { startCrawlRun, finishCrawlRun } from '@/lib/crawlRun';
import { prisma } from '@/lib/prisma';
import { getAppSettings } from '@/lib/settings';
import { sendPublishedArticleTelegram } from '@/lib/telegram';
import { generateContentHash, generateSlug, normalizeCanonicalUrl, titleSimilarity } from '@/lib/utils';
import { runRepoRadar } from './repoRadar';

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

type Candidate = ArticleData & {
  canonicalUrl: string;
  dedupeHash: string;
  sourceWeight: number;
};

function sourceWeight(sourceName: string, tags: string[]): number {
  const text = `${sourceName} ${tags.join(' ')}`.toLowerCase();
  if (/openai|anthropic|deepmind|google ai|meta ai/.test(text)) return 4;
  if (/hacker news|reddit|github/.test(text)) return 3;
  return 1;
}

function hasEnoughSignal(article: ArticleData): boolean {
  const url = article.originalUrl || article.sourceUrl;
  const text = `${article.title} ${article.summaryVi || ''} ${article.contentVi || ''}`.replace(/\s+/g, ' ').trim();
  return Boolean(url && article.sourceUrl && text.length >= 80);
}

function toCandidate(article: ArticleData): Candidate {
  const canonicalUrl = normalizeCanonicalUrl(article.originalUrl || article.sourceUrl);
  const sourceUrl = normalizeCanonicalUrl(article.sourceUrl);
  const originalUrl = normalizeCanonicalUrl(article.originalUrl);
  const dedupeHash = generateContentHash(canonicalUrl || sourceUrl || originalUrl, article.originalTitle || article.title);
  return {
    ...article,
    sourceUrl,
    originalUrl,
    canonicalUrl,
    contentHash: dedupeHash,
    dedupeHash,
    sourceWeight: sourceWeight(article.sourceName, article.tags || []),
  };
}

async function fetchCandidates(): Promise<{ candidates: Candidate[]; fetched: number; errors: string[] }> {
  const crawlers = [
    new RSSCrawler(),
    new HackerNewsCrawler(),
    new RedditCrawler(),
    new GitHubTrendingCrawler(),
  ];
  const candidates: Candidate[] = [];
  const errors: string[] = [];
  let fetched = 0;

  for (const crawler of crawlers) {
    try {
      console.log(`[Pipeline] Fetching ${crawler.name}`);
      const articles = await crawler.crawl();
      fetched += articles.length;
      for (const article of articles) {
        if (!hasEnoughSignal(article)) {
          continue;
        }
        candidates.push(toCandidate(article));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${crawler.name}: ${message}`);
    }
  }

  return { candidates, fetched, errors };
}

async function findDuplicate(candidate: Candidate): Promise<{ id: string; reason: string } | null> {
  const orConditions = [
    candidate.dedupeHash ? { contentHash: candidate.dedupeHash } : null,
    candidate.canonicalUrl ? { canonicalUrl: candidate.canonicalUrl } : null,
    candidate.originalUrl ? { originalUrl: candidate.originalUrl } : null,
    candidate.sourceUrl ? { sourceUrl: candidate.sourceUrl } : null,
  ].filter(Boolean) as Array<{ contentHash?: string; canonicalUrl?: string; originalUrl?: string; sourceUrl?: string }>;

  if (orConditions.length > 0) {
    const exact = await prisma.article.findFirst({ where: { OR: orConditions } });
    if (exact) return { id: exact.id, reason: 'exact-url-or-content-hash' };
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = await prisma.article.findMany({
    where: {
      status: { in: ['published', 'pending'] },
      createdAt: { gte: since },
    },
    select: { id: true, title: true },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  const similar = recent.find((article) => titleSimilarity(article.title, candidate.title) >= 0.84);
  return similar ? { id: similar.id, reason: 'similar-title-last-30-days' } : null;
}

async function dedupeCandidates(candidates: Candidate[]): Promise<{ unique: Candidate[]; duplicates: number; errors: string[] }> {
  const unique: Candidate[] = [];
  const seenUrls = new Map<string, Candidate>();
  let duplicates = 0;

  for (const candidate of candidates) {
    const key = candidate.canonicalUrl || candidate.dedupeHash;
    const inRunDuplicate = key ? seenUrls.get(key) : undefined;
    if (inRunDuplicate || unique.some((item) => titleSimilarity(item.title, candidate.title) >= 0.88)) {
      duplicates++;
      continue;
    }

    const existing = await findDuplicate(candidate);
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
  return [...candidates].sort((a, b) => {
    if (b.importanceScore !== a.importanceScore) return b.importanceScore - a.importanceScore;
    if (b.sourceWeight !== a.sourceWeight) return b.sourceWeight - a.sourceWeight;
    const aTime = a.originalPublishedAt?.getTime() || 0;
    const bTime = b.originalPublishedAt?.getTime() || 0;
    return bTime - aTime;
  });
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

async function createArticle(candidate: Candidate, status: 'pending' | 'published' | 'rejected', ai?: Awaited<ReturnType<typeof processArticleWithAI>>, aiError?: string): Promise<Article> {
  const title = ai?.titleVi || candidate.titleVi || candidate.title;
  const summaryVi = ai?.briefVi || candidate.briefVi || candidate.summaryVi;
  const tags = [...new Set([...(candidate.tags || []), ...(ai?.aiTags || [])])].filter(Boolean);
  const slug = await uniqueSlug(generateSlug(title || candidate.title));

  return prisma.article.create({
    data: {
      title,
      titleVi: ai?.titleVi || '',
      slug,
      summaryVi,
      briefVi: ai?.briefVi || '',
      whyImportant: ai?.whyImportant || '',
      contentVi: candidate.contentVi || summaryVi,
      sourceName: candidate.sourceName,
      sourceUrl: candidate.sourceUrl,
      originalUrl: candidate.originalUrl,
      originalTitle: candidate.originalTitle || candidate.title,
      originalPublishedAt: candidate.originalPublishedAt || new Date(),
      category: candidate.category,
      tags: tags.join(', '),
      aiTags: (ai?.aiTags || []).join(', '),
      targetAudience: ai?.targetAudience || '',
      impactLevel: ai?.impactLevel || '',
      importanceScore: candidate.importanceScore,
      reasonForScore: candidate.reasonForScore,
      status,
      aiProvider: ai?.provider || '',
      aiModel: ai?.model || '',
      aiStatus: ai?.status || (aiError ? 'failed' : 'pending'),
      aiError: aiError?.slice(0, 1000) || '',
      aiProcessedAt: ai || aiError ? new Date() : null,
      canonicalUrl: candidate.canonicalUrl,
      publishedAt: status === 'published' ? new Date() : null,
      contentHash: candidate.dedupeHash,
    },
  });
}

export async function runCrawlPipeline(): Promise<CrawlPipelineStats> {
  const settings = await getAppSettings();
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
    const fetched = await fetchCandidates();
    stats.fetched = fetched.fetched;
    stats.errors.push(...fetched.errors);

    const deduped = await dedupeCandidates(fetched.candidates);
    stats.candidates = deduped.unique.length;
    stats.duplicates = deduped.duplicates;
    stats.errors.push(...deduped.errors);

    const ranked = rankCandidates(deduped.unique);
    const eligible = ranked.filter((candidate) => candidate.importanceScore >= settings.min_score_to_publish);
    const selected = eligible.slice(0, settings.max_publish_per_crawl);
    const selectedKeys = new Set(selected.map((candidate) => candidate.dedupeHash));

    for (const candidate of ranked) {
      if (!selectedKeys.has(candidate.dedupeHash)) {
        const status = candidate.importanceScore >= settings.pending_threshold ? 'pending' : 'rejected';
        await createArticle(candidate, status);
        if (status === 'pending') stats.pending++;
        else stats.rejected++;
        continue;
      }

      let ai: Awaited<ReturnType<typeof processArticleWithAI>> | undefined;
      let aiError = '';
      if (settings.ai_translation_enabled && settings.ai_importance_reason_enabled) {
        try {
          ai = await processArticleWithAI({
            originalTitle: candidate.originalTitle || candidate.title,
            originalBrief: candidate.summaryVi || candidate.contentVi || candidate.title,
            sourceName: candidate.sourceName,
            sourceUrl: candidate.originalUrl || candidate.sourceUrl,
            category: candidate.category,
            tags: candidate.tags || [],
          });
          stats.aiSuccess++;
        } catch (error) {
          const message = error instanceof AiProcessingError || error instanceof Error ? error.message : String(error);
          aiError = message;
          stats.aiFailed++;
          stats.errors.push(`AI failed for "${candidate.title}": ${message}`);
        }
      } else {
        aiError = 'AI processing disabled';
      }

      const canPublish = Boolean(ai) || settings.allow_publish_without_ai;
      const article = await createArticle(candidate, canPublish ? 'published' : 'pending', ai, aiError);
      if (article.status === 'published') {
        stats.published++;
        const sent = await sendPublishedArticleTelegram({
          id: article.id,
          title: article.title,
          summaryVi: article.summaryVi,
          whyImportant: article.whyImportant,
          importanceScore: article.importanceScore,
          sourceName: article.sourceName,
          tags: article.tags,
          slug: article.slug,
        });
        if (sent) {
          await prisma.article.update({ where: { id: article.id }, data: { telegramSent: true } });
          stats.telegramSent++;
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      } else {
        stats.pending++;
      }
    }

    if (ranked.length === 0) {
      console.log('[Pipeline] No publishable candidates found; crawl still completed');
    }

    const repoRadar = await runRepoRadar();
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
