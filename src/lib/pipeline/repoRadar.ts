import { prisma } from '@/lib/prisma';
import { getAppSettings } from '@/lib/settings';
import { AiProcessingError, summarizeRepoWithAI } from '@/lib/ai/openRouter';

const TOPICS = [
  'artificial-intelligence',
  'machine-learning',
  'llm',
  'rag',
  'ai-agent',
  'generative-ai',
  'local-llm',
  'inference',
  'fine-tuning',
  'multimodal',
  'stable-diffusion',
  'computer-vision',
  'speech-to-text',
  'text-to-speech',
];

type GitHubRepo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  owner?: { login?: string };
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  language: string | null;
  topics?: string[];
  pushed_at: string | null;
  open_issues_count?: number;
};

export type RepoRadarResult = {
  found: number;
  upserted: number;
  aiSuccess: number;
  aiFailed: number;
  errors: string[];
};

function daysAgo(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

export function scoreRepo(repo: GitHubRepo): number {
  let score = 20;
  if (repo.stargazers_count >= 5000) score += 30;
  else if (repo.stargazers_count >= 1000) score += 20;
  else if (repo.stargazers_count >= 100) score += 10;

  if (repo.pushed_at && daysAgo(new Date(repo.pushed_at)) <= 30) score += 15;
  if ((repo.topics || []).some((topic) => TOPICS.includes(topic.toLowerCase()) || /llm|rag|agent|ai/.test(topic.toLowerCase()))) score += 20;
  if ((repo.description || '').trim().length >= 30) score += 10;
  if (repo.forks_count >= 500) score += 10;
  else if (repo.forks_count >= 100) score += 5;
  if (!(repo.description || '').trim()) score -= 10;
  if (repo.pushed_at && daysAgo(new Date(repo.pushed_at)) > 180) score -= 20;
  return Math.max(0, Math.min(100, score));
}

async function fetchTopic(topic: string): Promise<GitHubRepo[]> {
  const pushedAfter = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const query = encodeURIComponent(`topic:${topic} stars:>50 pushed:>${pushedAfter}`);
  const response = await fetch(`https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=10`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'AI-News-Viet-Nam/1.0',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`GitHub ${response.status} for topic ${topic}`);
  }
  const data = await response.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function runRepoRadar(): Promise<RepoRadarResult> {
  const settings = await getAppSettings();
  const errors: string[] = [];
  const repos = new Map<string, GitHubRepo>();

  for (const topic of TOPICS.slice(0, 8)) {
    try {
      const topicRepos = await fetchTopic(topic);
      for (const repo of topicRepos) {
        repos.set(repo.full_name, repo);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const ranked = [...repos.values()]
    .map((repo) => ({ repo, score: scoreRepo(repo) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  let upserted = 0;
  for (const { repo, score } of ranked) {
    await prisma.repoRadarItem.upsert({
      where: { fullName: repo.full_name },
      update: {
        repoName: repo.name,
        description: repo.description || '',
        url: repo.html_url,
        owner: repo.owner?.login || repo.full_name.split('/')[0],
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        language: repo.language || '',
        topics: (repo.topics || []).join(', '),
        lastPushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
        lastSeenAt: new Date(),
        repoScore: score,
      },
      create: {
        repoName: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        url: repo.html_url,
        owner: repo.owner?.login || repo.full_name.split('/')[0],
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        language: repo.language || '',
        topics: (repo.topics || []).join(', '),
        lastPushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
        repoScore: score,
      },
    });
    upserted++;
  }

  let aiSuccess = 0;
  let aiFailed = 0;
  const toProcess = await prisma.repoRadarItem.findMany({
    where: {
      status: 'tracked',
      OR: [{ aiStatus: 'pending' }, { aiSummaryVi: '' }],
    },
    orderBy: [{ repoScore: 'desc' }, { stars: 'desc' }],
    take: settings.max_repo_radar_ai_per_crawl,
  });

  if (process.env.OPENROUTER_API_KEY && settings.ai_translation_enabled) {
    for (const item of toProcess) {
      try {
        const ai = await summarizeRepoWithAI({
          fullName: item.fullName,
          description: item.description,
          stars: item.stars,
          forks: item.forks,
          language: item.language,
          topics: item.topics.split(',').map((topic) => topic.trim()).filter(Boolean),
          url: item.url,
        });
        await prisma.repoRadarItem.update({
          where: { id: item.id },
          data: {
            aiSummaryVi: ai.aiSummaryVi,
            whyImportant: ai.whyImportant,
            aiProvider: ai.provider,
            aiModel: ai.model,
            aiStatus: ai.status,
            aiError: '',
          },
        });
        aiSuccess++;
      } catch (error) {
        const aiError = error instanceof AiProcessingError ? error.message : error instanceof Error ? error.message : String(error);
        await prisma.repoRadarItem.update({
          where: { id: item.id },
          data: { aiStatus: 'failed', aiError: aiError.slice(0, 1000) },
        });
        aiFailed++;
      }
    }
  }

  return { found: repos.size, upserted, aiSuccess, aiFailed, errors };
}
