import BaseSourceCrawler from './BaseSourceCrawler';
import { ArticleData } from '@/types';
import Parser from 'rss-parser';

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

  private rssFeeds: string[] = [
    'https://openai.com/blog/rss.xml',
    'https://research.anthropic.com/rss.xml',
    'https://blog.google/technology/ai/rss/',
    'https://ai.meta.com/blog/rss/',
    'https://newsletter.vinta.com.br/rss.xml',
    'https://huyenchip.com/feed.xml',
    'https://lilianweng.github.io/feed.xml',
    'https://stability.ai/feed',
    'https://mistral.ai/feed.xml',
    'https://deepmind.google/blog/rss.xml',
  ];

  constructor() {
    super();
    this.parser = new Parser<CustomFeed, CustomItem>({
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; AI-News-Crawler/1.0; +https://github.com/ai-news)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
  }

  async fetch(): Promise<ArticleData[]> {
    const allItems: ArticleData[] = [];

    for (const feedUrl of this.rssFeeds) {
      try {
        const items = await this.fetchFeed(feedUrl);
        const sourceName = this.extractSourceName(feedUrl);
        if (items.length > 0) {
          console.log(`[RSS] Fetched ${items.length} items from ${feedUrl} -> sourceName="${sourceName}"`);
        }
        allItems.push(...items);
      } catch (err) {
        console.error(`[RSS] Error fetching ${feedUrl}:`, (err as Error).message);
      }
    }

    console.log(`[RSS] Total items fetched: ${allItems.length}`);
    return allItems;
  }

  private async fetchFeed(feedUrl: string): Promise<ArticleData[]> {
    const feed = await this.parser.parseURL(feedUrl);

    if (!feed.items || feed.items.length === 0) {
      return [];
    }

    const sourceName = this.extractSourceName(feedUrl);

    // Log source name once per subreddit (not per article)
    console.log(`[RSS] Feed "${feed.title || feedUrl}" => sourceName="${sourceName}"`);

    return feed.items
      .filter((item) => item.title)
      .map((item) => this.convertToArticle(item, feedUrl));
  }

  private convertToArticle(item: CustomItem, feedUrl: string): ArticleData {
    const sourceName = this.extractSourceName(feedUrl);
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
      originalPublishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
      category,
      tags,
      importanceScore: 0,
      reasonForScore: '',
      status: 'draft',
    };
  }

  private extractSourceName(feedUrl: string): string {
    const nameMap: Record<string, string> = {
      'openai.com': 'OpenAI Blog',
      'anthropic.com': 'Anthropic Blog',
      'blog.google': 'Google AI Blog',
      'ai.meta.com': 'Meta AI Blog',
      'deepmind.google': 'DeepMind Blog',
      // Non-DB sources — these names will NOT match any DB source,
      // so saveToDatabase() will correctly skip them.
      'vinta.com.br': 'Vinta',
      'huyenchip.com': 'Chip Huyen',
      'lilianweng.github.io': 'Lilian Weng',
      'stability.ai': 'Stability AI',
      'mistral.ai': 'Mistral AI',
    };

    for (const [domain, name] of Object.entries(nameMap)) {
      if (feedUrl.includes(domain)) return name;
    }
    return new URL(feedUrl).hostname;
  }
}
