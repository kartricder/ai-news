import BaseSourceCrawler from './BaseSourceCrawler';
import { ArticleData } from '@/types';

interface RSSItem {
  title?: string;
  link?: string;
  description?: string;
  content?: string;
  contentSnippet?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: Date;
  creator?: string;
  categories?: string[];
}

export class RSSCrawler extends BaseSourceCrawler {
  name = 'RSS Blogs';
  sourceType = 'rss';

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

  async fetch(): Promise<ArticleData[]> {
    const allItems: ArticleData[] = [];

    for (const feedUrl of this.rssFeeds) {
      try {
        const items = await this.fetchFeed(feedUrl);
        allItems.push(...items);
      } catch (err) {
        console.error(`[RSS] Error fetching ${feedUrl}:`, err);
      }
    }

    return allItems;
  }

  private async fetchFeed(feedUrl: string): Promise<ArticleData[]> {
    // Use rss2json for parsing RSS (free tier)
    const response = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&api_key=wt1sr4hrhp7iuqy7ynmcmvxysdks7xwjqy1a3pks`
    );

    if (!response.ok) {
      console.warn(`[RSS] Failed to fetch ${feedUrl}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (data.status !== 'ok' || !data.items) return [];

    return data.items
      .filter((item: RSSItem) => item.title)
      .map((item: RSSItem) => this.convertToArticle(item, feedUrl));
  }

  private convertToArticle(item: RSSItem, feedUrl: string): ArticleData {
    const sourceName = this.extractSourceName(feedUrl);
    const tags = ['RSS', sourceName.replace(/\s+/g, '-').toLowerCase()];

    let category = 'research';
    if (/model|gpt|claude|gemini|llama|release|launch/i.test(item.title || '')) category = 'model-release';
    if (/breakthrough|achievement|first|world record/i.test(item.title || '')) category = 'breakthrough';
    if (/agent|tool|product|app|platform/i.test(item.title || '')) category = 'tool-release';

    return {
      title: item.title || '',
      summaryVi: item.contentSnippet?.substring(0, 300) || item.description?.substring(0, 300) || '',
      contentVi: item.content || item.description || '',
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
      'openai.com': 'OpenAI',
      'anthropic.com': 'Anthropic',
      'blog.google': 'Google AI',
      'ai.meta.com': 'Meta AI',
      'vinta.com.br': 'Vinta',
      'huyenchip.com': 'Chip Huyen',
      'lilianweng.github.io': 'Lilian Weng',
      'stability.ai': 'Stability AI',
      'mistral.ai': 'Mistral AI',
      'deepmind.google': 'Google DeepMind',
    };

    for (const [domain, name] of Object.entries(nameMap)) {
      if (feedUrl.includes(domain)) return name;
    }
    return new URL(feedUrl).hostname;
  }
}
