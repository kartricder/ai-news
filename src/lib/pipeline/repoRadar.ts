import { prisma } from '@/lib/prisma';
import { getAppSettings } from '@/lib/settings';
import { AiProcessingError, summarizeRepoWithAI } from '@/lib/ai/openRouter';
import { safeFetch } from '@/lib/sources/fetch';
import { createHash, randomUUID } from 'node:crypto';
import { getAiConfiguration } from '@/lib/ai/budget';
import { AI_PROMPT_VERSION, AI_SCHEMA_VERSION, boundedText, objectValue } from '@/lib/ai/schema';

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
  const response = await safeFetch(`https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=10`, {
    authHost: 'api.github.com',
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'AI-News-Viet-Nam/1.0',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    timeoutMs: 10_000,
  });

  if (response.status !== 200) {
    throw new Error(`GitHub ${response.status} for topic ${topic}`);
  }
  const data = JSON.parse(response.text);
  return Array.isArray(data.items) ? data.items : [];
}

export async function runRepoRadar(aiLimit = 10): Promise<RepoRadarResult> {
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
  const now = new Date();
  const configuration = await getAiConfiguration();
  await prisma.repoRadarItem.updateMany({ where: { status: 'tracked', leaseUntil: { lte: now }, processingAttempts: { gte: 3 } },
    data: { aiStatus: 'failed', aiError: 'expired-lease-attempt-limit', leaseOwner: null, leaseUntil: null, nextRetryAt: null } });
  const toProcess = await prisma.repoRadarItem.findMany({
    where: {
      status: 'tracked',
      processingAttempts: { lt: 3 },
      AND: [
        { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
        { OR: [{ nextRetryAt: null, aiStatus: 'pending' }, { nextRetryAt: { lte: now } }] },
      ],
      OR: [{ aiStatus: 'pending' }, { aiSummaryVi: '' }],
    },
    orderBy: [{ repoScore: 'desc' }, { stars: 'desc' }],
    take: Math.max(0, Math.min(10, aiLimit, settings.max_repo_radar_ai_per_crawl)),
  });

  if (configuration.enabled && process.env.OPENROUTER_API_KEY && (settings.ai_translation_enabled || settings.ai_importance_reason_enabled)) {
    for (const item of toProcess) {
      const owner = randomUUID();
      const claimed = await prisma.repoRadarItem.updateMany({ where: { id: item.id, updatedAt: item.updatedAt, status: 'tracked',
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }, data: { leaseOwner: owner, leaseUntil: new Date(Date.now() + 300_000), processingAttempts: { increment: 1 } } });
      if (!claimed.count) continue;
      try {
        const input = {
          fullName: item.fullName,
          description: item.description,
          stars: item.stars,
          forks: item.forks,
          language: item.language,
          topics: item.topics.split(',').map((topic) => topic.trim()).filter(Boolean),
          url: item.url,
        };
        const inputHash = createHash('sha256').update(JSON.stringify({ ...input, translationEnabled: settings.ai_translation_enabled, reasonEnabled: settings.ai_importance_reason_enabled })).digest('hex');
        const key = { articleId: `repo:${item.id}`, inputHash, promptVersion: AI_PROMPT_VERSION, schemaVersion: AI_SCHEMA_VERSION };
        const cached = await prisma.aiResultCache.findUnique({ where: { articleId_inputHash_promptVersion_schemaVersion: key } });
        const stored = (() => {
          if (!cached) return null;
          try { const json = objectValue(JSON.parse(cached.resultJson)); boundedText(json.aiSummaryVi, 350, settings.ai_translation_enabled); boundedText(json.whyImportant, 700, settings.ai_importance_reason_enabled); return json; }
          catch { throw new AiProcessingError('Repository cache requires review', 'failed', undefined, 'schema'); }
        })();
        const ai = stored ? { aiSummaryVi: settings.ai_translation_enabled ? boundedText(stored.aiSummaryVi, 350) : '', whyImportant: settings.ai_importance_reason_enabled ? boundedText(stored.whyImportant, 700) : '',
          provider: boundedText(stored.provider, 200), model: boundedText(stored.model, 200), status: stored.status === 'fallback_success' ? 'fallback_success' : 'success', requiresReview: stored.requiresReview !== false }
          : await summarizeRepoWithAI({ ...input, repoId: item.id, leaseOwner: owner });
        const changed = await prisma.repoRadarItem.updateMany({
          where: { id: item.id, status: 'tracked', leaseOwner: owner, leaseUntil: { gt: new Date() }, description: item.description },
          data: {
            aiSummaryVi: ai.aiSummaryVi,
            whyImportant: ai.whyImportant,
            aiProvider: ai.provider,
            aiModel: ai.model,
            aiStatus: ai.requiresReview ? 'review' : ai.status,
            aiError: ai.requiresReview ? 'AI quality review required' : '', inputHash, leaseOwner: null, leaseUntil: null, nextRetryAt: null,
          },
        });
        if (changed.count) {
          await prisma.aiResultCache.upsert({ where: { articleId_inputHash_promptVersion_schemaVersion: key }, create: { ...key, resultJson: JSON.stringify(ai) }, update: {} });
          aiSuccess++;
        }
      } catch (error) {
        const failure = error instanceof AiProcessingError ? error : new AiProcessingError('Repository processing failed', 'failed', undefined, 'internal');
        const waitForOperator = ['configuration', 'input-limit', 'disabled', 'schema'].includes(failure.code) || failure.status === 'blocked';
        const noCallBudget = failure.code === 'budget' && failure.callsMade === 0;
        const retryAt = waitForOperator || item.processingAttempts >= 2 && !noCallBudget ? null : new Date(Math.max(Date.now() + [5, 30, 120][Math.min(2, item.processingAttempts)] * 60_000, failure.nextRetryAt?.getTime() || 0));
        await prisma.repoRadarItem.updateMany({
          where: { id: item.id, leaseOwner: owner },
          data: { aiStatus: waitForOperator ? 'review' : 'failed', aiError: failure.code, leaseOwner: null, leaseUntil: null, nextRetryAt: retryAt,
            ...((failure.code === 'budget' || failure.code === 'configuration') && failure.callsMade === 0 ? { processingAttempts: { decrement: 1 } } : {}) },
        });
        aiFailed++;
        if (failure.code === 'budget' || failure.code === 'configuration') break;
      }
    }
  }

  return { found: repos.size, upserted, aiSuccess, aiFailed, errors };
}
