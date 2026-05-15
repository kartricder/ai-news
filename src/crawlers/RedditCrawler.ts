import BaseSourceCrawler from './BaseSourceCrawler';
import { ArticleData } from '@/types';

interface RedditPost {
  data: {
    title: string;
    selftext: string;
    url: string;
    score: number;
    num_comments: number;
    author: string;
    created_utc: number;
    permalink: string;
    ups: number;
    upvote_ratio: number;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
  };
}

const SUBREDDITS = [
  'artificial',
  'MachineLearning',
  'LocalLLaMA',
  'OpenAI',
  'singularity',
  'ArtificialIntelligence',
  'deeplearning',
];

export class RedditCrawler extends BaseSourceCrawler {
  name = 'Reddit';
  sourceType = 'reddit';

  async fetch(): Promise<ArticleData[]> {
    const allPosts: RedditPost[] = [];

    for (const subreddit of SUBREDDITS) {
      try {
        const response = await fetch(
          `https://www.reddit.com/r/${subreddit}/hot.json?limit=15`,
          {
            headers: { 'User-Agent': 'AI-News-Aggregator/1.0' },
          }
        );
        const data: RedditResponse = await response.json();
        allPosts.push(...data.data.children);
      } catch (err) {
        console.error(`[Reddit] Error fetching r/${subreddit}:`, err);
      }
    }

    // Remove duplicates by title
    const seen = new Set<string>();
    const uniquePosts = allPosts.filter(post => {
      const lower = post.data.title.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });

    return uniquePosts.map(post => this.convertToArticle(post.data));
  }

  private convertToArticle(post: RedditPost['data']): ArticleData {
    const tags = ['Reddit'];
    if (/llm|gpt|model/i.test(post.title)) tags.push('llm');
    if (/open source|github|release/i.test(post.title)) tags.push('open-source');

    return {
      title: post.title,
      summaryVi: `[Reddit r/${post.permalink.split('/')[2]}] ${post.title}`,
      contentVi: post.selftext || '',
      sourceName: this.name,
      sourceUrl: `https://reddit.com${post.permalink}`,
      originalUrl: post.url,
      originalTitle: post.title,
      originalPublishedAt: new Date(post.created_utc * 1000),
      category: this.guessCategory(post.title),
      tags,
      importanceScore: 0,
      reasonForScore: '',
      status: 'draft',
    };
  }

  private guessCategory(title: string): string {
    if (/model|gpt|llama|claude|gemini|release/i.test(title)) return 'model-release';
    if (/research|paper|study/i.test(title)) return 'research';
    if (/agent|tool|library|framework/i.test(title)) return 'tool-release';
    return 'research';
  }
}
