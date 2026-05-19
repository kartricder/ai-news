import { prisma } from '@/lib/prisma';
import { ArticleData } from '@/types';
import { generateSlug, generateContentHash } from '@/lib/utils';
import { calculateScore } from '@/scoring';
import { getAppSettings } from '@/lib/settings';

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
    const { score, reasons } = calculateScore({
      sourceName: item.sourceName,
      title: item.title,
      content: item.summaryVi || item.title,
      tags: item.tags,
      category: item.category,
      originalPublishedAt: item.originalPublishedAt,
    });

    const settings = await getAppSettings();
    let status: 'published' | 'pending' | 'rejected';
    if (score >= settings.publish_threshold) {
      status = 'published';
    } else if (score >= settings.pending_threshold) {
      status = 'pending';
    } else {
      status = 'rejected';
    }

    return {
      ...item,
      importanceScore: score,
      reasonForScore: reasons.join('; '),
      status,
      slug: generateSlug(item.title),
    };
  }

  private normalizeTitle(title: string): string {
    return title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  }

  private normalizeUrl(url: string): string {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      parsed.hash = '';
      for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
        parsed.searchParams.delete(key);
      }
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return url.trim().replace(/\/$/, '');
    }
  }

  private titleSimilarity(a: string, b: string): number {
    const aWords = new Set(this.normalizeTitle(a).split(' ').filter(Boolean));
    const bWords = new Set(this.normalizeTitle(b).split(' ').filter(Boolean));
    if (aWords.size === 0 || bWords.size === 0) return 0;
    let intersection = 0;
    for (const word of aWords) {
      if (bWords.has(word)) intersection++;
    }
    return intersection / Math.max(aWords.size, bWords.size);
  }

  private async findDuplicate(article: ArticleData, hash: string) {
    const originalUrl = this.normalizeUrl(article.originalUrl);
    const sourceUrl = this.normalizeUrl(article.sourceUrl);
    const canonicalUrl = originalUrl || sourceUrl;

    const orConditions = [
      hash ? { contentHash: hash } : null,
      originalUrl ? { originalUrl } : null,
      sourceUrl && sourceUrl === originalUrl ? { sourceUrl } : null,
    ].filter(Boolean) as Array<{ contentHash?: string; originalUrl?: string; sourceUrl?: string }>;

    if (orConditions.length > 0) {
      const exact = await prisma.article.findFirst({ where: { OR: orConditions } });
      if (exact) return exact;
    }

    if (!canonicalUrl) return null;

    const sameSourceCandidates = await prisma.article.findMany({
      where: {
        sourceName: article.sourceName,
        OR: [{ originalUrl: canonicalUrl }, { sourceUrl: canonicalUrl }],
      },
      take: 10,
    });

    return sameSourceCandidates.find((candidate) => this.titleSimilarity(candidate.title, article.title) >= 0.82) || null;
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

        const originalUrl = this.normalizeUrl(article.originalUrl);
        const sourceUrl = this.normalizeUrl(article.sourceUrl);
        const hash = generateContentHash(originalUrl || sourceUrl, article.title);
        const duplicate = await this.findDuplicate({ ...article, originalUrl, sourceUrl }, hash);
        if (duplicate) {
          duplicates++;
          continue;
        }

        const slug = await this.uniqueSlug(article.slug || generateSlug(article.title));
        const created = await prisma.article.create({
          data: {
            ...article,
            slug,
            tags: Array.isArray(article.tags) ? article.tags.join(', ') : article.tags,
            originalPublishedAt: article.originalPublishedAt || new Date(),
            publishedAt: article.status === 'published' ? new Date() : null,
            contentHash: hash,
            originalUrl,
            sourceUrl,
            sourceName: article.sourceName,
          },
        });

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
