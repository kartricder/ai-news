import type { SourceKind, SourceFetchResult } from '../news/types';
import { validateSourceUrl } from './fetch';

export const sourceTypes = ['rss', 'hackernews', 'reddit', 'github', 'arxiv', 'github-release'] as const;
export type SourceType = typeof sourceTypes[number];
export type SourceConfig = {
  id: string;
  catalogId: string | null;
  name: string;
  type: SourceType;
  publisherKey: string;
  kind: SourceKind;
  language: string | null;
  url: string;
  enabled: boolean;
  intervalMinutes: number;
  timeoutMs: number;
  maxItems: number;
  verificationStatus: string;
  etag?: string | null;
  lastModified?: string | null;
  authEnv?: string;
  filterAI: boolean;
};
export type SourceProbeResult = SourceFetchResult & {
  finalUrl?: string;
  contentType?: string;
  etag?: string;
  lastModified?: string;
  retryAfterMs?: number;
  samples: { title: string; url: string; publishedAt: string | null }[];
  verificationStatus: 'verified' | 'failed';
  stale: boolean;
};
export type CatalogEntry = {
  catalogId: string;
  name: string;
  type: SourceType;
  publisherKey: string;
  kind: SourceKind;
  language: string;
  url: string;
  discoveryUrl: string;
  intervalMinutes: number;
  maxItems: number;
  filterAI: boolean;
};

export const sourceCatalog: CatalogEntry[] = [
  ['openai-blog', 'OpenAI Blog', 'openai', 'official', 'https://openai.com/blog/rss.xml', 'https://openai.com/news/'],
  ['google-ai', 'Google AI Blog', 'google', 'official', 'https://blog.google/technology/ai/rss/', 'https://blog.google/technology/ai/'],
  ['deepmind-blog', 'DeepMind Blog', 'google', 'research', 'https://deepmind.google/blog/rss.xml', 'https://deepmind.google/blog/'],
  ['huggingface-blog', 'HuggingFace Blog', 'huggingface', 'engineering', 'https://huggingface.co/blog/feed.xml', 'https://huggingface.co/blog'],
  ['nvidia-developer', 'NVIDIA Developer', 'nvidia', 'engineering', 'https://developer.nvidia.com/blog/feed/', 'https://www.nvidia.com/en-us/about-nvidia/rss/'],
  ['microsoft-research', 'Microsoft Research', 'microsoft', 'research', 'https://www.microsoft.com/en-us/research/feed/', 'https://www.microsoft.com/en-us/research/blog/'],
  ['aws-machine-learning', 'AWS Machine Learning', 'amazon', 'engineering', 'https://aws.amazon.com/blogs/machine-learning/feed/', 'https://aws.amazon.com/blogs/machine-learning/'],
  ['google-research', 'Google Research', 'google', 'research', 'https://research.google/blog/rss/', 'https://research.google/blog/'],
  ['techcrunch-ai', 'TechCrunch AI', 'techcrunch', 'media', 'https://techcrunch.com/category/artificial-intelligence/feed/', 'https://techcrunch.com/category/artificial-intelligence/'],
  ['ars-technica', 'Ars Technica', 'ars-technica', 'media', 'https://feeds.arstechnica.com/arstechnica/index', 'https://arstechnica.com/'],
  ['vnexpress-so-hoa', 'VnExpress So hoa', 'vnexpress', 'media', 'https://vnexpress.net/rss/so-hoa.rss', 'https://vnexpress.net/rss'],
  ['vietnamnet-cong-nghe', 'VietnamNet Cong nghe', 'vietnamnet', 'media', 'https://vietnamnet.vn/rss/cong-nghe.rss', 'https://vietnamnet.vn/'],
].map(([catalogId, name, publisherKey, kind, url, discoveryUrl]) => ({
  catalogId, name, publisherKey, kind: kind as SourceKind, url, discoveryUrl, type: 'rss',
  language: ['vnexpress', 'vietnamnet'].includes(publisherKey) ? 'vi' : 'en',
  intervalMinutes: 60, maxItems: 30, filterAI: ['ars-technica', 'vnexpress', 'vietnamnet'].includes(publisherKey),
}));

for (const category of ['cs.AI', 'cs.CL', 'cs.LG', 'cs.CV']) sourceCatalog.push({
  catalogId: `arxiv-${category.toLowerCase().replace('.', '-')}`, name: `arXiv ${category}`,
  type: 'arxiv', publisherKey: 'arxiv', kind: 'research', language: 'en',
  url: `https://export.arxiv.org/api/query?search_query=cat:${category}&sortBy=submittedDate&sortOrder=descending&max_results=20`,
  discoveryUrl: 'https://info.arxiv.org/help/api/index.html', intervalMinutes: 1440, maxItems: 20, filterAI: false,
});
for (const repository of ['vllm-project/vllm', 'huggingface/transformers', 'ggml-org/llama.cpp']) sourceCatalog.push({
  catalogId: `github-releases-${repository.replaceAll('/', '-')}`, name: `Releases ${repository}`,
  type: 'github-release', publisherKey: repository.split('/')[0], kind: 'engineering', language: 'en',
  url: `https://api.github.com/repos/${repository}/releases`, discoveryUrl: `https://github.com/${repository}/releases`,
  intervalMinutes: 60, maxItems: 20, filterAI: false,
});

export function catalogConfig(entry: CatalogEntry): SourceConfig {
  return { ...entry, id: entry.catalogId, enabled: false, verificationStatus: 'unverified', timeoutMs: 10_000 };
}

export function toSourceConfig(source: {
  id: string; name: string; type: string; url: string; enabled: boolean; configJson: string;
  catalogId?: string | null; publisherKey?: string; kind?: string; language?: string | null;
  verificationStatus?: string; etag?: string | null; lastModified?: string | null;
}): SourceConfig {
  if (!sourceTypes.includes(source.type as SourceType)) throw new Error('unsupported-source-type');
  const config = JSON.parse(source.configJson || '{}');
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('invalid-source-config');
  if (Object.keys(config).some((key) => !['intervalMinutes', 'timeoutMs', 'maxItems', 'authEnv', 'filterAI'].includes(key))) throw new Error('unsupported-config-field');
  if (config.filterAI !== undefined && typeof config.filterAI !== 'boolean') throw new Error('invalid-ai-filter');
  if (source.kind && !['official', 'research', 'engineering', 'media', 'community'].includes(source.kind)) throw new Error('invalid-source-kind');
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const value = config[key] ?? fallback;
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`invalid-${key}`);
    return value as number;
  };
  const entry = sourceCatalog.find((item) => item.catalogId === source.catalogId || item.name === source.name);
  const url = validateSourceUrl(source.url);
  if (source.type.startsWith('github') && (url.hostname !== 'api.github.com' || url.protocol !== 'https:' ||
      !(source.type === 'github-release' ? /^\/repos\/[\w.-]+\/[\w.-]+\/releases\/?$/.test(url.pathname) : url.pathname === '/search/repositories'))) throw new Error('invalid-github-endpoint');
  if (source.type === 'reddit' && (!['www.reddit.com', 'reddit.com'].includes(url.hostname) || !/^\/r\/[\w]+\/(hot|new|top)\.json\/?$/.test(url.pathname))) throw new Error('invalid-reddit-endpoint');
  if (source.type === 'hackernews' && !(url.hostname === 'hn.algolia.com' && /^\/api\/v1\/search(_by_date)?$/.test(url.pathname))) throw new Error('invalid-hackernews-endpoint');
  if (source.type === 'arxiv' && (url.hostname !== 'export.arxiv.org' || url.protocol !== 'https:' || url.pathname !== '/api/query')) throw new Error('invalid-arxiv-endpoint');
  if (config.authEnv && (!/^[A-Z][A-Z0-9_]*$/.test(config.authEnv) || !source.type.startsWith('github'))) throw new Error('invalid-auth-reference');
  return {
    id: source.id, name: source.name, type: source.type as SourceType, catalogId: source.catalogId || entry?.catalogId || null,
    url: url.toString(), enabled: source.enabled,
    publisherKey: source.publisherKey || entry?.publisherKey || (/\breddit\.com$/.test(url.hostname) ? 'reddit' : source.type === 'hackernews' ? 'hackernews' : url.hostname.replace(/^www\./, '')),
    kind: (source.kind || entry?.kind || (['reddit', 'hackernews', 'github'].includes(source.type) || /\breddit\.com$/.test(url.hostname) ? 'community' : 'media')) as SourceKind,
    language: source.language || entry?.language || null,
    intervalMinutes: integer('intervalMinutes', entry?.intervalMinutes || 60, 1, 10080),
    timeoutMs: integer('timeoutMs', 10_000, 1000, 30_000),
    maxItems: integer('maxItems', entry?.maxItems || 30, 1, source.type === 'arxiv' ? 20 : 100),
    verificationStatus: source.verificationStatus || 'unverified', etag: source.etag, lastModified: source.lastModified,
    authEnv: config.authEnv || (source.type.startsWith('github') ? 'GITHUB_TOKEN' : undefined),
    filterAI: config.filterAI === undefined ? entry?.filterAI ?? true : config.filterAI === true,
  };
}