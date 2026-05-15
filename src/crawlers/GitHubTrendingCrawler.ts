import BaseSourceCrawler from './BaseSourceCrawler';
import { ArticleData } from '@/types';

interface GHRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  stargazers_count: number;
  language: string;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

export class GitHubTrendingCrawler extends BaseSourceCrawler {
  name = 'GitHub Trending';
  sourceType = 'github';

  async fetch(): Promise<ArticleData[]> {
    // Fetch trending repos from GitHub API (last week, AI/ML related)
    const repos: GHRepo[] = await this.fetchTrendingRepos();
    const aiRepos = repos.filter(repo => this.isAIRepo(repo));
    return aiRepos.map(repo => this.convertToArticle(repo));
  }

  private async fetchTrendingRepos(): Promise<GHRepo[]> {
    // Get repos created in last 7 days, sorted by stars
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    // First try via GitHub search
    const aiQuery = encodeURIComponent(
      `topic:ai created:>${oneWeekAgo} stars:>10 sort:stars-desc`
    );
    
    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${aiQuery}&per_page=30&sort=stars&order=desc`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'AI-News-Aggregator/1.0',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.items || [];
      }
    } catch (err) {
      console.error('[GitHub] Search API failed, trying alternative...');
    }

    // Fallback: fetch trending page
    try {
      const response = await fetch(
        'https://api.github.com/search/repositories?q=created:>2026-01-01+stars:>50&sort=stars&per_page=50',
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'AI-News-Aggregator/1.0',
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        return data.items || [];
      }
    } catch (err) {
      console.error('[GitHub] Fallback also failed:', err);
    }

    return [];
  }

  private isAIRepo(repo: GHRepo): boolean {
    const aiTopics = [
      'ai', 'artificial-intelligence', 'machine-learning', 'deep-learning',
      'llm', 'gpt', 'neural-network', 'nlp', 'natural-language-processing',
      'computer-vision', 'reinforcement-learning', 'transformer', 'rag',
      'agent', 'autonomous', 'chatbot', 'langchain', 'vector-database',
      'embedding', 'diffusion', 'generative-ai', 'fine-tuning',
    ];

    const hasAITopic = (repo.topics || []).some(t => aiTopics.includes(t.toLowerCase()));
    const desc = (repo.description || '').toLowerCase();
    const name = repo.name.toLowerCase();
    const hasAIDesc = aiTopics.some(t => 
      desc.includes(t) || name.includes(t)
    );

    return hasAITopic || hasAIDesc;
  }

  private convertToArticle(repo: GHRepo): ArticleData {
    const tags = ['open-source', 'github', repo.language || 'code'].filter(Boolean);

    // Extract category from topics
    let category = 'tool-release';
    if (repo.topics?.some(t => /llm|gpt|model|transformer/i.test(t))) category = 'model-release';
    if (repo.topics?.some(t => /research|paper/i.test(t))) category = 'research';

    return {
      title: `${repo.name}: ${repo.description || 'A trending AI repository'}`,
      summaryVi: `⭐ Sao: ${repo.stargazers_count.toLocaleString()} | Ngôn ngữ: ${repo.language || 'N/A'} | Mô tả: ${repo.description || 'Không có mô tả'}`,
      contentVi: `## ${repo.full_name}\n\n${repo.description || ''}\n\n### Thông tin:\n- ⭐ Stars: ${repo.stargazers_count.toLocaleString()}\n- 🔤 Ngôn ngữ: ${repo.language || 'N/A'}\n- 🏷️ Topics: ${(repo.topics || []).join(', ') || 'N/A'}\n\n🔗 [Xem trên GitHub](${repo.html_url})`,
      sourceName: this.name,
      sourceUrl: repo.html_url,
      originalUrl: repo.html_url,
      originalTitle: repo.full_name,
      originalPublishedAt: new Date(repo.created_at),
      category,
      tags,
      importanceScore: 0,
      reasonForScore: '',
      status: 'draft',
    };
  }
}
