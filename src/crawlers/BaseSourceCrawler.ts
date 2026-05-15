import { prisma } from '@/lib/prisma';
import { ArticleData } from '@/types';
import { generateSlug, generateContentHash } from '@/lib/utils';
import { calculateScore } from '@/scoring';
import { getAppSettings } from '@/lib/settings';
import { startCrawlRun, finishCrawlRun } from '@/lib/crawlRun';

abstract class BaseSourceCrawler {
  abstract name: string;
  abstract sourceType: string;

  async crawl(sourceId: string): Promise<ArticleData[]> {
    console.log(`[${this.name}] Starting crawl...`);
    const articles: ArticleData[] = [];
    const errors: string[] = [];

    try {
      const fetched = await this.fetch();
      for (const item of fetched) {
        try {
          const validated = await this.validateAndScore(item);
          if (validated) articles.push(validated);
        } catch (err: any) {
          errors.push(`Error processing item: ${err.message}`);
        }
      }
    } catch (err: any) {
      errors.push(`Fetch error: ${err.message}`);
    }

    console.log(`[${this.name}] Fetched ${fetched.length} items, kept ${articles.length} after scoring`);
    return articles;
  }

  abstract fetch(): Promise<ArticleData[]>;

  async validateAndScore(item: ArticleData): Promise<ArticleData | null> {
    const { score, reasons } = calculateScore({
      sourceName: this.name,
      title: item.title,
      content: item.summaryVi || item.title,
      tags: item.tags,
      category: item.category,
      originalPublishedAt: item.originalPublishedAt,
    });

    const settings = await getAppSettings();
    let status: string;
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

  async saveToDatabase(articles: ArticleData[], runId: string): Promise<void> {
    let totalPublished = 0;
    let totalRejected = 0;
    let totalPending = 0;

    for (const article of articles) {
      try {
        const hash = generateContentHash(article.originalUrl, article.title);
        
        // Check duplicate
        const existing = await prisma.article.findUnique({
          where: { slug: article.slug },
        });
        if (existing) {
          // Try with suffixed slug
          article.slug = article.slug + '-' + Math.random().toString(36).substring(2, 6);
        }

        await prisma.article.create({
          data: {
            ...article,
            originalPublishedAt: article.originalPublishedAt || new Date(),
            contentHash: hash,
            sourceName: this.name,
          },
        });

        if (article.status === 'published') totalPublished++;
        else if (article.status === 'rejected') totalRejected++;
        else totalPending++;
      } catch (err: any) {
        console.error(`Error saving article "${article.title}": ${err.message}`);
      }
    }

    await finishCrawlRun(runId, {
      totalFetched: articles.length,
      totalPublished,
      totalRejected,
      totalPending,
    });
  }

  async run(): Promise<{ published: number; pending: number; rejected: number }> {
    const runId = await startCrawlRun();
    const source = await prisma.source.findFirst({ where: { name: this.name } });
    if (!source || !source.enabled) {
      console.log(`[${this.name}] Source disabled or not found, skipping`);
      return { published: 0, pending: 0, rejected: 0 };
    }

    const articles = await this.crawl(source.id);
    await this.saveToDatabase(articles, runId);

    const stats = { published: 0, pending: 0, rejected: 0 };
    for (const a of articles) {
      if (a.status === 'published') stats.published++;
      else if (a.status === 'pending') stats.pending++;
      else stats.rejected++;
    }
    return stats;
  }
}

export default BaseSourceCrawler;
