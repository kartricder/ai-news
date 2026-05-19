import BaseSourceCrawler from './BaseSourceCrawler';
import { ArticleData } from '@/types';
import Parser from 'rss-parser';
import { prisma } from '@/lib/prisma';

interface CustomFeed {
  title?: string;
  description?: string;
  link?: string;
}

interface CustomItem {
  title?: string;
  link?: string;
  guid?: string;
  contentSnippet?: string;
  content?: string;
  'content:encoded'?: string;
  isoDate?: string;
  pubDate?: string;
  creator?: string;
  categories?: string[];
}

export class RSSCrawler extends BaseSourceCrawler {
  name = 'RSS Blogs';
  sourceType = 'rss';

  private parser: Parser<CustomFeed, CustomItem>;

  constructor() {
    super();
    this.parser = new Parser<CustomFeed, CustomItem>({
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-News-Crawler/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
  }

  async fetch(): Promise<ArticleData[]> {
    const allItems: ArticleData[] = [];
    const sources = await prisma.source.findMany({
      where: { type: 'rss', enabled: true },
      orderBy: { name: 'asc' },
    });

    for (const source of sources) {
      try {
        const items = await this.fetchFeed(source.url, source.name);
        if (items.length > 0) {
          console.log(`[RSS] Fetched ${items.length} items from ${source.url} -> sourceName="${source.name}"`);
        }
        allItems.push(...items);
      } catch (err) {
        const message = `Error fetching ${source.url}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[RSS] ${message}`);
        this.recordError(message);
      }
    }

    console.log(`[RSS] Total items fetched: ${allItems.length}`);
    return allItems;
  }

  private async fetchFeed(feedUrl: string, sourceName: string): Promise<ArticleData[]> {
    const feed = await this.parser.parseURL(feedUrl);

    if (!feed.items || feed.items.length === 0) {
      return [];
    }

    console.log(`[RSS] Feed "${feed.title || feedUrl}" => sourceName="${sourceName}"`);

    return feed.items
      .filter((item) => item.title)
      .map((item) => this.convertToArticle(item, feedUrl, sourceName));
  }

  private convertToArticle(item: CustomItem, feedUrl: string, sourceName: string): ArticleData {
    const tags = ['RSS', sourceName.replace(/\s+/g, '-').toLowerCase()];

    let category = 'research';
    if (/model|gpt|claude|gemini|llama|release|launch/i.test(item.title || '')) category = 'model-release';
    if (/breakthrough|achievement|first|world record/i.test(item.title || '')) category = 'breakthrough';
    if (/agent|tool|product|app|platform/i.test(item.title || '')) category = 'tool-release';

    const rawContent = item.content || item['content:encoded'] || '';
    const snippet = item.contentSnippet || rawContent.replace(/<[^>]*>/g, '').substring(0, 300) || '';

    return {
      title: item.title || '',
      slug: `${sourceName.toLowerCase().replace(/\s+/g, '-')}-${(item.guid || item.link || Math.random().toString(36)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50)}`,
      summaryVi: snippet.substring(0, 300),
      contentVi: rawContent,
      contentHash: '',
      sourceName,
      sourceUrl: feedUrl,
      originalUrl: item.link || '',
      originalTitle: item.title || '',
      originalPublishedAt: item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : new Date(),
      category,
      tags,
      importanceScore: 0,
      reasonForScore: '',
      status: 'draft',
    };
  }
}
