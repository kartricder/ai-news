import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Article, Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { resolveSqliteUrl } from '../databaseUrl';
import { getAppSettings } from '../settings';
import { normalizeNews, assessEvidence } from '../news/normalize';
import { scoreNews, selectCandidates } from '../news/rank';
import { AI_PROMPT_VERSION, AI_SCHEMA_VERSION, parseArticleOutput, type AiArticleInput, type ValidatedAiResult } from '../ai/schema';
import { AiProcessingError, processArticleWithAI } from '../ai/openRouter';
import { getAiConfiguration, parseAiConfiguration, estimateAttemptUsd } from '../ai/budget';
import { assessAiQuality } from '../ai/quality';
import { sendPublishedArticleTelegram } from '../telegram';
import type { EvidenceLevel, SourceKind } from '../news/types';

export type ProcessingSummary = {
  selected: number; processed: number; published: number; review: number; failed: number; skippedBudget: number;
  errors: string[]; telegramSent: number;
  aiSuccess: number; aiFailed: number;
  estimatedUsdUpperBound?: number | null;
};
const emptySummary = (): ProcessingSummary => ({ selected: 0, processed: 0, published: 0, review: 0, failed: 0, skippedBudget: 0, errors: [], telegramSent: 0, aiSuccess: 0, aiFailed: 0 });
function flags(value: string): string[] {
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string') ? parsed : ['invalid-quality-flags']; }
  catch { return ['invalid-quality-flags']; }
}
function candidateFor(article: Article, clock: Date) {
  const item = normalizeNews({ sourceId: article.sourceId || '', externalId: article.externalId || undefined,
    title: article.originalTitle || article.title, text: article.originalText, sourceUrl: article.sourceUrl, articleUrl: article.originalUrl,
    publishedAt: article.originalPublishedAt?.toISOString() || null, fetchedAt: clock.toISOString(), language: article.originalLanguage,
    evidenceLevel: (['title_only', 'snippet', 'abstract', 'article'].includes(article.evidenceLevel) ? article.evidenceLevel : 'title_only') as EvidenceLevel,
    qualityFlags: flags(article.qualityFlags),
  });
  const sourceKind = (['official', 'research', 'engineering', 'media', 'community'].includes(article.sourceKind) ? article.sourceKind : 'media') as SourceKind;
  return { article, item, sourceKind, publisherKey: article.publisherKey || article.sourceName,
    breakdown: scoreNews(item, { clock, sourceKind }), eligibleForAI: assessEvidence(item).eligibleForAI && !article.identityReviewReason && !!article.identityKey && !article.duplicateOfId };
}

function preview(limit: number): ProcessingSummary {
  const url = resolveSqliteUrl(process.env.DATABASE_URL, process.cwd());
  const database = new Database(path.normalize(url.slice(5)), { readonly: true, fileMustExist: true });
  try {
    const settings = database.prepare('SELECT key, value FROM AppSetting WHERE encrypted = 0').all() as { key: string; value: string }[];
    const rawValue = (key: string, fallback: string) => settings.find((setting) => setting.key === key)?.value || process.env[key.toUpperCase()] || fallback;
    const value = (key: string, fallback: number) => { const parsed = Number.parseInt(rawValue(key, String(fallback)), 10); return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback; };
    const now = new Date();
    const configuration = parseAiConfiguration(Object.fromEntries(settings.map((setting) => [setting.key, setting.value])));
    const rows = database.prepare(`SELECT * FROM Article WHERE status = 'pending' AND processingAttempts < 3
      AND processingStatus IN ('queued', 'ready', 'retry_wait', 'processing')
      ORDER BY createdAt ASC`).all() as Record<string, unknown>[];
    const articles = rows.map((row) => {
      const article = { ...row };
      for (const key of ['originalPublishedAt', 'fetchedAt', 'createdAt', 'updatedAt', 'publishedAt', 'nextRetryAt', 'leaseUntil']) article[key] = row[key] == null ? null : new Date(typeof row[key] === 'string' && /^\d+$/.test(row[key]) ? Number(row[key]) : row[key] as string | number);
      return article as unknown as Article;
    }).filter((article) => article.processingStatus === 'queued' || article.processingStatus === 'ready' && configuration.autoPublish ||
      article.processingStatus === 'retry_wait' && (!article.nextRetryAt || article.nextRetryAt <= now) ||
      article.processingStatus === 'processing' && article.leaseUntil && article.leaseUntil <= now);
    const selected = selectCandidates(articles.map((article) => candidateFor(article, now)), { limit, threshold: Math.max(value('publish_threshold', 75), value('min_score_to_publish', 75)), perPublisher: 2, community: 3 });
    const modelKeys = ['openrouter_model', 'openrouter_fallback_model', 'openrouter_second_fallback_model'];
    const defaults = ['openrouter/auto', 'google/gemini-2.5-flash', 'mistralai/mistral-small-3.2-24b-instruct'];
    const models = [...new Set(modelKeys.map((key, index) => rawValue(key, defaults[index])).filter(Boolean))].slice(0, 3);
    const estimates = models.map((model) => estimateAttemptUsd(configuration, model));
    const aiRequested = ['ai_translation_enabled', 'ai_importance_reason_enabled'].some((key) => ['true', '1', 'yes'].includes(rawValue(key, 'true').toLowerCase()));
    const configured = !aiRequested || estimates.some((estimate) => estimate !== null);
    const upperBound = estimates.reduce<number>((total, estimate) => total + (estimate ?? 0) * 2, 0) * selected.length;
    return { ...emptySummary(), selected: selected.length, estimatedUsdUpperBound: configured ? aiRequested ? upperBound : 0 : null,
      errors: configured ? [] : ['pricing-or-budget-not-configured-estimate-unknown'] };
  } finally { database.close(); }
}

export async function processPendingArticles(options: { limit: number; dryRun: boolean }): Promise<ProcessingSummary> {
  if (options.dryRun) return processPendingBatch(options);
  const owner = randomUUID();
  const now = new Date();
  const claimed = await prisma.$transaction(async (transaction) => {
    await transaction.workerLease.upsert({ where: { name: 'pending-batch' }, create: { name: 'pending-batch', owner: '', leaseUntil: now }, update: {} });
    return transaction.workerLease.updateMany({ where: { name: 'pending-batch', leaseUntil: { lte: now } }, data: { owner, leaseUntil: new Date(Date.now() + 300_000) } });
  });
  if (!claimed.count) return { ...emptySummary(), errors: ['pending-worker-already-running'] };
  try { return await processPendingBatch(options, owner); }
  finally { await prisma.workerLease.updateMany({ where: { name: 'pending-batch', owner }, data: { leaseUntil: new Date(), owner: '' } }); }
}

async function processPendingBatch(options: { limit: number; dryRun: boolean }, batchOwner?: string): Promise<ProcessingSummary> {
  const limit = Math.max(0, Math.min(10, Number.isFinite(options.limit) ? Math.floor(options.limit) : 0));
  if (options.dryRun) return preview(limit);
  const summary = emptySummary();
  if (!limit) return summary;
  const settings = await getAppSettings();
  const configuration = await getAiConfiguration();
  const now = new Date();
  await prisma.article.updateMany({ where: { status: 'pending', processingStatus: 'processing', leaseUntil: { lte: now }, processingAttempts: { gte: 3 } },
    data: { processingStatus: 'failed', processingReason: 'expired-lease-attempt-limit', leaseOwner: null, leaseUntil: null } });
  const due: Prisma.ArticleWhereInput = { status: 'pending', processingAttempts: { lt: 3 }, OR: [
    { processingStatus: { in: configuration.autoPublish ? ['queued', 'ready'] : ['queued'] } },
    { processingStatus: 'retry_wait', OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
    { processingStatus: 'processing', leaseUntil: { lte: now } },
  ] };
  const rows = await prisma.article.findMany({ where: due, orderBy: [{ processingAttempts: 'asc' }, { createdAt: 'asc' }] });
  const candidates = rows.map((article) => candidateFor(article, now));
  for (const candidate of candidates) {
    const gate = assessEvidence(candidate.item);
    if (!candidate.eligibleForAI || gate.requiresReview) {
      const moved = await prisma.article.updateMany({ where: { id: candidate.article.id, status: 'pending', processingStatus: candidate.article.processingStatus, leaseOwner: candidate.article.leaseOwner,
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }, data: { processingStatus: 'review', leaseOwner: null, leaseUntil: null,
        processingReason: candidate.article.identityReviewReason || gate.reasons.join('; ') || 'missing-identity', qualityFlags: JSON.stringify(gate.reasons) } });
      summary.review += moved.count;
    }
  }
  const selected = selectCandidates(candidates, { limit, threshold: Math.max(settings.min_score_to_publish, settings.publish_threshold), perPublisher: 2, community: 3 });
  summary.selected = selected.length;
  for (const candidate of selected) {
    if (batchOwner) {
      const renewed = await prisma.workerLease.updateMany({ where: { name: 'pending-batch', owner: batchOwner, leaseUntil: { gt: new Date() } }, data: { leaseUntil: new Date(Date.now() + 300_000) } });
      if (!renewed.count) { summary.errors.push('pending-batch-lease-lost'); break; }
    }
    const article = candidate.article;
    const owner = randomUUID();
    const claimed = await prisma.article.updateMany({ where: { AND: [due, { id: article.id, updatedAt: article.updatedAt }] }, data: {
      processingStatus: 'processing', leaseOwner: owner, leaseUntil: new Date(Date.now() + 300_000), processingAttempts: { increment: 1 }, nextRetryAt: null,
    } });
    if (!claimed.count) continue;
    try {
      const input: AiArticleInput = { articleId: article.id, leaseOwner: owner, originalTitle: candidate.item.title, originalText: candidate.item.originalText,
        sourceName: article.sourceName, sourceUrl: article.originalUrl, category: candidate.item.category,
        evidenceLevel: candidate.item.evidenceLevel, tags: article.tags.split(',').map((tag) => tag.trim()).filter(Boolean), policyFlags: candidate.item.qualityFlags,
        translationEnabled: settings.ai_translation_enabled, reasonEnabled: settings.ai_importance_reason_enabled };
      const inputHash = createHash('sha256').update(JSON.stringify({ ...input, leaseOwner: undefined })).digest('hex');
      const prepared = await prisma.article.updateMany({ where: { id: article.id, leaseOwner: owner, leaseUntil: { gt: new Date() }, processingStatus: 'processing' },
        data: { inputHash, promptVersion: AI_PROMPT_VERSION, schemaVersion: AI_SCHEMA_VERSION } });
      if (!prepared.count) throw new AiProcessingError('Processing lease lost', 'failed', undefined, 'lease-lost');
      const cacheKey = { articleId: article.id, inputHash, promptVersion: AI_PROMPT_VERSION, schemaVersion: AI_SCHEMA_VERSION };
      const cache = await prisma.aiResultCache.findUnique({ where: { articleId_inputHash_promptVersion_schemaVersion: cacheKey } });
      let ai: ValidatedAiResult | undefined;
      if (cache) {
        try {
        const stored = JSON.parse(cache.resultJson) as ValidatedAiResult;
        const output = parseArticleOutput(stored, settings.ai_translation_enabled, settings.ai_importance_reason_enabled);
        const quality = assessAiQuality(input, output);
        ai = { ...stored, ...output, requiresReview: quality.requiresReview, qualityFlags: quality.flags };
        } catch { throw new AiProcessingError('Cached result requires editor review', 'failed', undefined, 'schema'); }
      } else if (settings.ai_translation_enabled || settings.ai_importance_reason_enabled) {
        ai = await processArticleWithAI(input);
        summary.aiSuccess++;
      }
      const gate = assessEvidence(candidate.item);
      const vietnameseOriginal = candidate.item.language?.startsWith('vi');
      const translationReady = !!ai?.titleVi && !!ai.briefVi || !!vietnameseOriginal;
      const bypassTranslation = settings.allow_publish_without_ai && vietnameseOriginal && !settings.ai_translation_enabled;
      const usable = !gate.requiresReview && !ai?.requiresReview && translationReady && (Boolean(ai) || bypassTranslation);
      const publish = configuration.autoPublish && usable && summary.published < Math.min(10, settings.max_publish_per_crawl);
      const result = await prisma.$transaction(async (transaction) => {
        const changed = await transaction.article.updateMany({ where: { id: article.id, status: 'pending', processingStatus: 'processing', leaseOwner: owner,
          leaseUntil: { gt: new Date() }, identityReviewReason: '', fingerprint: article.fingerprint, pendingFingerprint: article.pendingFingerprint }, data: {
          ...(ai ? { titleVi: ai.titleVi, summaryVi: ai.briefVi || (vietnameseOriginal ? candidate.item.originalText.slice(0, 450) : ''), briefVi: ai.briefVi,
            whyImportant: ai.whyImportant, contentVi: ai.briefVi, aiTags: ai.aiTags.join(', '), targetAudience: ai.targetAudience, impactLevel: ai.impactLevel,
            aiProvider: ai.provider, aiModel: ai.model, aiStatus: ai.status, aiError: '', aiProcessedAt: new Date(),
            aiClaims: JSON.stringify(ai.claims), aiUncertainties: JSON.stringify(ai.uncertainties), qualityFlags: JSON.stringify(ai.qualityFlags) } : {}),
          processingStatus: usable ? 'ready' : ai?.requiresReview ? 'review' : 'skipped',
          processingReason: publish ? 'auto-published-quality-gates' : usable ? 'ready-auto-publish-disabled' : ai?.requiresReview ? 'ai-quality-review' : 'translation-or-ai-required',
          status: publish ? 'published' : 'pending', publishedAt: publish ? new Date() : null,
          importanceScore: candidate.breakdown.total, scoreBreakdown: JSON.stringify(candidate.breakdown), reasonForScore: candidate.breakdown.reasons.join('; '),
          promptVersion: AI_PROMPT_VERSION, schemaVersion: AI_SCHEMA_VERSION, inputHash, leaseOwner: null, leaseUntil: null,
          processingAttempts: 0,
        } });
        if (!changed.count) return false;
        if (ai && !cache) await transaction.aiResultCache.upsert({ where: { articleId_inputHash_promptVersion_schemaVersion: cacheKey },
          create: { ...cacheKey, resultJson: JSON.stringify(ai) }, update: { resultJson: JSON.stringify(ai) } });
        return true;
      });
      if (!result) { summary.errors.push(`${article.id}: lease or input changed`); continue; }
      summary.processed++;
      if (!usable) summary.review++;
      if (publish) {
        summary.published++;
        try {
          const sent = await sendPublishedArticleTelegram({ id: article.id, title: ai?.titleVi || article.title, summaryVi: ai?.briefVi || article.summaryVi,
            whyImportant: ai?.whyImportant || '', importanceScore: candidate.breakdown.total, sourceName: article.sourceName, tags: article.tags, slug: article.slug });
          if (sent) { await prisma.article.update({ where: { id: article.id }, data: { telegramSent: true } }); summary.telegramSent++; }
        } catch { summary.errors.push(`${article.id}: telegram-delivery-failed`); }
      }
    } catch (error) {
      const failure = error instanceof AiProcessingError ? error : new AiProcessingError('Processing or persistence failed', 'failed', undefined, 'internal');
      const budget = failure.code === 'budget';
      const configurationError = ['configuration', 'disabled', 'input-limit'].includes(failure.code);
      const review = failure.status === 'blocked' || ['evidence', 'schema'].includes(failure.code);
      if (!budget && !configurationError && !['evidence', 'lease-lost'].includes(failure.code)) summary.aiFailed++;
      const cycles = article.processingAttempts + 1;
      const deferBudget = budget && (failure.callsMade === 0 || cycles < 3);
      const retry = !configurationError && !review && cycles < 3;
      const delays = [5, 30, 120];
      const retryAt = new Date(Math.max(Date.now() + delays[Math.min(2, article.processingAttempts)] * 60_000, failure.nextRetryAt?.getTime() || 0));
      await prisma.article.updateMany({ where: { id: article.id, leaseOwner: owner, processingStatus: 'processing' }, data: {
        processingStatus: deferBudget || retry ? 'retry_wait' : review || configurationError ? 'review' : 'failed',
        processingReason: failure.code, aiStatus: failure.status, aiError: failure.message.slice(0, 500),
        nextRetryAt: deferBudget || retry ? retryAt : null, leaseOwner: null, leaseUntil: null,
        ...((budget || configurationError) && failure.callsMade === 0 ? { processingAttempts: { decrement: 1 } } : {}),
      } });
      if (budget) summary.skippedBudget++;
      else if (review || configurationError) summary.review++;
      else summary.failed++;
      summary.errors.push(`${article.id}: ${failure.code}`);
      if (budget || configurationError) break;
    }
  }
  return summary;
}