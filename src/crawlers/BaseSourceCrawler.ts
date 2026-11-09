import { prisma } from '@/lib/prisma';
import { ArticleData } from '@/types';
import { generateSlug } from '@/lib/utils';
import { getIdentityKey } from '@/lib/news/identity';
import { normalizeNews, assessEvidence } from '@/lib/news/normalize';
import { scoreNews } from '@/lib/news/rank';
import { createIdentityArticle, findIdentityOwner } from '@/lib/news/storeIdentity';

export type SavedCrawlerStats = {
  fetched: number;
  published: number;
  pending: number;
  rejected: number;
  duplicates: number;
  errors: string[];
  publishedArticles: { title: string; url: string; score: number; summary: string }[];
};

abstract class BaseSourceCrawler {
  abstract name: string;
  abstract sourceType: string;
  protected sourceErrors: string[] = [];

  getErrors(): string[] { return [...this.sourceErrors]; }

  protected recordError(message: string): void {
    this.sourceErrors.push(message);
  }

  async crawl(): Promise<ArticleData[]> {
    console.log(`[${this.name}] Starting crawl...`);
    this.sourceErrors = [];
    const articles: ArticleData[] = [];
    const errors: string[] = [];
    let fetched: ArticleData[] = [];

    try {
      fetched = await this.fetch();
      for (const item of fetched) {
        try {
          const validated = await this.validateAndScore(item);
          if (validated) articles.push(validated);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`Error processing item: ${message}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Fetch error: ${message}`);
    }

    this.sourceErrors.push(...errors);
    if (this.sourceErrors.length > 0) {
      for (const error of this.sourceErrors) console.error(`[${this.name}] ${error}`);
    }
    console.log(`[${this.name}] Fetched ${fetched.length} items, kept ${articles.length} after scoring`);
    return articles;
  }

  abstract fetch(): Promise<ArticleData[]>;

  async validateAndScore(item: ArticleData): Promise<ArticleData | null> {
    if (!item.title.trim()) return null;
    return {
      ...item,
      status: 'pending',
      slug: generateSlug(item.title),
    };
  }

  private async uniqueSlug(baseSlug: string): Promise<string> {
    const cleanBase = baseSlug || generateSlug(`article-${Date.now()}`);
    let slug = cleanBase;
    let suffix = 1;
    while (await prisma.article.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${cleanBase}-${suffix}`;
    }
    return slug;
  }

  async saveToDatabase(articles: ArticleData[]): Promise<SavedCrawlerStats> {
    let totalPublished = 0;
    let totalRejected = 0;
    let totalPending = 0;
    let duplicates = 0;
    const errors: string[] = [...this.sourceErrors];
    const publishedArticles: SavedCrawlerStats['publishedArticles'] = [];

    for (const article of articles) {
      try {
        const source = await prisma.source.findFirst({ where: { name: article.sourceName } });
        if (!source) {
          const message = `Source "${article.sourceName}" not found in DB, skipped "${article.title}"`;
          console.warn(`[${this.name}] ${message}`);
          errors.push(message);
          continue;
        }

        const clock = new Date();
        const normalized = normalizeNews(article.newsItem || {
          sourceId: article.sourceId || source.id,
          externalId: article.externalId,
          articleUrl: article.originalUrl,
          sourceUrl: article.sourceUrl,
          title: article.originalTitle || article.title,
          text: article.originalText ?? (article.contentVi || article.summaryVi),
          publishedAt: article.originalPublishedAt && Number.isFinite(article.originalPublishedAt.getTime()) ? article.originalPublishedAt.toISOString() : null,
          fetchedAt: clock.toISOString(),
          language: null,
          evidenceLevel: 'snippet',
        });
        const canonicalUrl = normalized.canonicalUrl;
        const identityKey = getIdentityKey(normalized);
        const fingerprint = normalized.fingerprint;
        const gate = assessEvidence(normalized);
        const breakdown = scoreNews(normalized, { clock, sourceKind: article.sourceKind || 'media' });
        const duplicate = await findIdentityOwner({ identityKey, fingerprint });
        if (duplicate) {
          duplicates++;
          continue;
        }

        const slug = await this.uniqueSlug(article.slug || generateSlug(article.title));
        const articleData = { ...article };
        delete articleData.originalText;
        delete articleData.newsItem;
        const { aiTags, ...storedData } = articleData;
        const saved = await createIdentityArticle({
            ...storedData,
            slug,
            tags: Array.isArray(article.tags) ? article.tags.join(', ') : article.tags,
            aiTags: Array.isArray(aiTags) ? aiTags.join(', ') : aiTags || '',
            originalPublishedAt: normalized.publishedAt ? new Date(normalized.publishedAt) : null,
            originalTitle: normalized.title,
            originalText: normalized.originalText,
            originalLanguage: normalized.language,
            fetchedAt: new Date(normalized.fetchedAt),
            evidenceLevel: normalized.evidenceLevel,
            qualityFlags: JSON.stringify(gate.reasons),
            category: normalized.category,
            summaryVi: normalized.language?.startsWith('vi') ? normalized.originalText.slice(0, 450) : '',
            contentVi: '',
            scoreVersion: breakdown.version,
            scoreBreakdown: JSON.stringify(breakdown),
            importanceScore: breakdown.total,
            reasonForScore: breakdown.reasons.join('; '),
            status: 'pending',
            publishedAt: null,
            processingReason: 'legacy-save-requires-pipeline-review',
            contentHash: fingerprint,
            fingerprint,
            identityKey,
            canonicalUrl,
            sourceId: article.sourceId || source.id,
            sourceName: article.sourceName,
        });
        if (!saved.created) {
          duplicates++;
          continue;
        }
        const created = saved.article;

        if (created.status === 'published') {
          totalPublished++;
          publishedArticles.push({
            title: created.title,
            url: created.originalUrl || created.sourceUrl,
            score: created.importanceScore,
            summary: created.summaryVi,
          });
        } else if (created.status === 'rejected') {
          totalRejected++;
        } else {
          totalPending++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const fullMessage = `Error saving "${article.title}": ${message}`;
        console.error(`[${this.name}] ${fullMessage}`);
        errors.push(fullMessage);
      }
    }

    return {
      fetched: articles.length,
      published: totalPublished,
      rejected: totalRejected,
      pending: totalPending,
      duplicates,
      errors,
      publishedArticles,
    };
  }

  async run(): Promise<SavedCrawlerStats> {
    const articles = await this.crawl();
    return this.saveToDatabase(articles);
  }
}

export default BaseSourceCrawler;
