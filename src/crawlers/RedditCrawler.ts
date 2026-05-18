import BaseSourceCrawler from './BaseSourceCrawler';
import { ArticleData } from '@/types';

interface RedditPost {
  data: {
    id: string;
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
  'deeplearning',
];

export class RedditCrawler extends BaseSourceCrawler {
  name = 'Reddit';
  sourceType = 'reddit';

  async fetch(): Promise<ArticleData[]> {
    const allPosts: Array<{ subreddit: string; post: RedditPost['data'] }> = [];

    for (const subreddit of SUBREDDITS) {
      try {
        const response = await fetch(
          `https://www.reddit.com/r/${subreddit}/hot.json?limit=15`,
          {
            headers: { 'User-Agent': 'AI-News-Aggregator/1.0' },
          }
        );
        const data: RedditResponse = await response.json();
        if (!data?.data?.children) {
          console.warn(`[Reddit] r/${subreddit}: unexpected response shape, skipping`);
          continue;
        }
        for (const child of data.data.children) {
          if (child?.data) {
            allPosts.push({ subreddit, post: child.data });
          }
        }
      } catch (err) {
        console.error(`[Reddit] Error fetching r/${subreddit}:`, (err as Error).message);
      }
    }

    // Remove duplicates by title
    const seen = new Set<string>();
    const uniquePosts = allPosts.filter(item => {
      const lower = item.post.title.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });

    return uniquePosts.map(item => this.convertToArticle(item.post, item.subreddit));
  }

  private subredditToSourceName(subreddit: string): string {
    const map: Record<string, string> = {
      'LocalLLaMA': 'Reddit r/LocalLLaMA',
      'MachineLearning': 'Reddit r/MachineLearning',
      'OpenAI': 'Reddit r/OpenAI',
      // Subreddits without matching DB source will be tagged with a fallback
      // and skipped by saveToDatabase()
    };
    const name = map[subreddit] || `Reddit r/${subreddit}`;
    // Log source name once per subreddit (not per article)
    console.log(`[Reddit] r/${subreddit} => sourceName="${name}"`);
    return name;
  }

  private convertToArticle(post: RedditPost['data'], subreddit: string): ArticleData {
    const sourceName = this.subredditToSourceName(subreddit);
    const tags = ['Reddit'];
    if (/llm|gpt|model/i.test(post.title)) tags.push('llm');
    if (/open source|github|release/i.test(post.title)) tags.push('open-source');

    return {
      title: post.title,
      slug: `reddit-${post.id}`,
      summaryVi: `[Reddit r/${subreddit}] ${post.title}`,
      contentVi: post.selftext || '',
      contentHash: '',
      sourceName,
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
