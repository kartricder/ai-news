import BaseSourceCrawler from './BaseSourceCrawler';
import { ArticleData } from '@/types';

// Hacker News API response types
interface HNItem {
  id: number;
  title: string;
  url?: string;
  text?: string;
  score: number;
  descendants: number;
  by: string;
  time: number;
  type: string;
}

export class HackerNewsCrawler extends BaseSourceCrawler {
  name = 'Hacker News';
  sourceType = 'hackernews';

  async fetch(): Promise<ArticleData[]> {
    const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids: number[] = await response.json();
    const topIds = ids.slice(0, 30); // Get top 30

    const items: HNItem[] = [];
    const batchSize = 10;

    for (let i = 0; i < topIds.length; i += batchSize) {
      const batch = topIds.slice(i, i + batchSize);
      const promises = batch.map(id =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
      );
      const results = await Promise.all(promises);
      items.push(...results.filter(r => r && r.type === 'story'));
    }

    // Filter AI-related stories
    const aiKeywords = /ai|artificial intelligence|machine learning|deep learning|llm|gpt|neural|transformer|language model|openai|anthropic|gemini|llama|mistral|deepseek/i;

    return items
      .filter(item => aiKeywords.test(item.title + (item.text || '')))
      .map(item => this.convertToArticle(item));
  }

  private convertToArticle(item: HNItem): ArticleData {
    const tags = ['AI'];
    if (/llm|gpt|language model|openai|anthropic/i.test(item.title)) tags.push('llm');
    if (/machine learning|deep learning|neural/i.test(item.title)) tags.push('machine-learning');
    if (/open source/i.test(item.title)) tags.push('open-source');

    return {
      title: item.title,
      slug: `hn-${item.id}`,
      summaryVi: item.text ? item.text.substring(0, 300) : `Bài viết trên Hacker News bởi ${item.by}`,
      contentVi: item.text || '',
      contentHash: '',
      sourceName: this.name,
      sourceUrl: `https://news.ycombinator.com/item?id=${item.id}`,
      originalUrl: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      originalTitle: item.title,
      originalPublishedAt: new Date(item.time * 1000),
      category: this.guessCategory(item.title),
      tags,
      importanceScore: 0,
      reasonForScore: '',
      status: 'draft',
    };
  }

  private guessCategory(title: string): string {
    if (/model|gpt|llama|claude|gemini|mistral|deepseek/i.test(title)) return 'model-release';
    if (/research|paper|study|breakthrough/i.test(title)) return 'research';
    if (/agent|tool|library|framework|open source/i.test(title)) return 'tool-release';
    if (/funding|acquisition|revenue|ipo/i.test(title)) return 'industry';
    return 'research';
  }
}
