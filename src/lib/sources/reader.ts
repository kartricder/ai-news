import Parser from 'rss-parser';
import { load } from 'cheerio';
import { safeFetch, SourceFetchError, retryAfterMilliseconds } from './fetch';
import type { SourceConfig, SourceProbeResult } from './catalog';
import { isAiRelevant, plainText } from '../news/normalize';
import { normalizeArticleUrl } from '../news/identity';
import type { RawNewsItem } from '../news/types';

const parser = new Parser({ customFields: { item: ['content:encoded', 'summary', 'id'] } });

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SourceFetchError('invalid-json-shape');
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new SourceFetchError('invalid-json-array');
  return value;
}
function string(value: unknown): string { return typeof value === 'string' ? value : ''; }
function identifier(value: unknown): string { return typeof value === 'number' || typeof value === 'string' ? String(value) : ''; }
function unixDate(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
}

async function readSource(source: SourceConfig): Promise<SourceProbeResult> {
  const started = Date.now();
  const fetchedAt = new Date(started).toISOString();
  const headers: Record<string, string> = {};
  if (source.etag) headers['If-None-Match'] = source.etag;
  if (source.lastModified) headers['If-Modified-Since'] = source.lastModified;
  const url = new URL(source.url);
  if (source.type.startsWith('github')) {
    if (url.protocol !== 'https:' || url.hostname !== 'api.github.com') throw new SourceFetchError('invalid-auth-host');
    headers.Accept = 'application/vnd.github+json';
    headers['X-GitHub-Api-Version'] = '2026-03-10';
    const token = source.authEnv ? process.env[source.authEnv] : undefined;
    if (token) headers.Authorization = `Bearer ${token}`;
    url.searchParams.set('per_page', String(source.maxItems));
    if (source.type === 'github' && !url.searchParams.get('q')) throw new SourceFetchError('missing-github-query');
  }
  if (source.type === 'hackernews') {
    url.searchParams.set('hitsPerPage', String(source.maxItems));
    url.searchParams.set('tags', 'story');
  }
  if (source.type === 'reddit') url.searchParams.set('limit', String(source.maxItems));
  if (source.type === 'arxiv') {
    const category = url.searchParams.get('search_query')?.match(/^cat:(cs\.(?:AI|CL|LG|CV))$/)?.[1];
    if (!category) throw new SourceFetchError('invalid-arxiv-category');
    const stamp = (date: Date) => date.toISOString().replace(/[-:T]/g, '').slice(0, 12);
    url.searchParams.set('search_query', `cat:${category} AND submittedDate:[${stamp(new Date(started - 7 * 86_400_000))} TO ${stamp(new Date(started))}]`);
    url.searchParams.set('max_results', String(Math.min(20, source.maxItems)));
    url.searchParams.set('sortBy', 'submittedDate');
    url.searchParams.set('sortOrder', 'descending');
  }
  const response = await safeFetch(url.toString(), { headers, authHost: 'api.github.com', timeoutMs: source.timeoutMs });
  const base = {
    sourceId: source.id, fetchedAt, httpStatus: response.status, finalUrl: response.url,
    contentType: response.headers['content-type'], etag: response.headers.etag, lastModified: response.headers['last-modified'],
    retryAfterMs: retryAfterMilliseconds(response.headers['retry-after']), durationMs: Date.now() - started,
  };
  if (response.status === 304) return { ...base, status: 'not_modified', items: [], samples: [], verificationStatus: 'failed', stale: false };
  if (response.status < 200 || response.status >= 300) {
    const reset = Number(response.headers['x-ratelimit-reset']);
    return { ...base, status: 'failed', items: [], samples: [], verificationStatus: 'failed', stale: false, errorCode: `http-${response.status}`,
      retryAfterMs: base.retryAfterMs ?? (response.headers['x-ratelimit-remaining'] === '0' && Number.isFinite(reset) ? Math.min(86_400_000, Math.max(0, reset * 1000 - Date.now())) : undefined) };
  }
  try {
  const makeItem = (title: string, articleUrl: string, text: string, publishedAt: string | null, externalId?: string): RawNewsItem => ({
    sourceId: source.id, sourceUrl: source.url, title, articleUrl, text, publishedAt, externalId,
    fetchedAt, language: source.language, evidenceLevel: text ? 'snippet' : 'title_only',
  });
  let items: RawNewsItem[] = [];
  if (source.type === 'rss' || source.type === 'arxiv') {
    if (/text\/html/i.test(base.contentType || '') || /<!doctype\s+html|<html[\s>]/i.test(response.text)) throw new SourceFetchError('html-not-feed', response.status);
    if (/<!DOCTYPE|<!ENTITY/i.test(response.text)) throw new SourceFetchError('xml-entity-not-allowed');
    if (source.type === 'arxiv') {
      const document = load(response.text, { xmlMode: true });
      if (!document('feed').length || document('entry > title').toArray().some((element) => document(element).text() === 'Error')) throw new SourceFetchError('invalid-arxiv-feed');
      items = document('entry').toArray().map((entry) => {
        const element = document(entry);
        const rawId = element.children('id').text().replace(/^https?:\/\/arxiv\.org\/abs\//, '');
        if (!/^(?:\d{4}\.\d{4,5}|[\w.-]+\/\d{7})v\d+$/.test(rawId)) throw new SourceFetchError('invalid-arxiv-id');
        return { ...makeItem(element.children('title').text(), `https://arxiv.org/abs/${rawId}`, element.children('summary').text(), element.children('published').text() || null, rawId),
          evidenceLevel: 'abstract' as const, category: 'research' as const,
          eventKey: `arxiv:${rawId.replace(/v\d+$/, '')}`, externalVersion: rawId.match(/v\d+$/)?.[0],
          tags: element.children('category').toArray().map((category) => document(category).attr('term') || '').filter(Boolean),
        };
      });
    } else {
      const feed = await parser.parseString(response.text);
      if (!Array.isArray(feed.items)) throw new SourceFetchError('invalid-feed');
      items = feed.items.map((entry) => {
        let link = entry.link || '';
        try { if (link) link = new URL(link, response.url).toString(); } catch { link = ''; }
        const text = entry['content:encoded'] || entry.content || entry.summary || entry.contentSnippet || '';
        return makeItem(entry.title || '', link, text, entry.isoDate || entry.pubDate || null, entry.guid || entry.id);
      });
    }
  } else {
    const json: unknown = JSON.parse(response.text);
    if (source.type === 'github-release') {
      const repository = url.pathname.split('/').slice(2, 4).join('/');
      items = array(json).map(record).filter((entry) => entry.draft === false).map((entry) => {
        const item = makeItem(`${repository} ${string(entry.tag_name)} release`, string(entry.html_url), string(entry.body), string(entry.published_at) || null, identifier(entry.id));
        return { ...item, category: 'open-source' as const, qualityFlags: entry.prerelease === true ? ['prerelease'] : [],
          eventKey: `github-release:${repository}:${identifier(entry.id)}`, externalVersion: string(entry.tag_name), tags: ['github-release', repository] };
      });
    } else if (source.type === 'github') {
      items = array(record(json).items).map(record).map((entry) => ({
        ...makeItem(string(entry.full_name), string(entry.html_url), string(entry.description), string(entry.created_at) || null, identifier(entry.id)),
        category: 'open-source' as const, tags: ['github', 'repository-discovery'], qualityFlags: ['repository-discovery-not-release'],
      }));
    } else if (source.type === 'hackernews') {
      items = array(record(json).hits).map(record).map((entry) => ({
        ...makeItem(string(entry.title), string(entry.url), string(entry.story_text), string(entry.created_at) || null, identifier(entry.objectID)),
        sourceUrl: `https://news.ycombinator.com/item?id=${encodeURIComponent(identifier(entry.objectID))}`,
      }));
    } else {
      items = array(record(record(json).data).children).map((child) => record(record(child).data)).map((entry) => ({
        ...makeItem(string(entry.title), string(entry.url), string(entry.selftext), unixDate(entry.created_utc), identifier(entry.id)),
        sourceUrl: `https://www.reddit.com${string(entry.permalink)}`,
      }));
    }
  }
  const valid = items.filter((item) => item.title.trim() && normalizeArticleUrl(item.articleUrl));
  if (!valid.length) throw new SourceFetchError('no-valid-source-items', response.status);
  const quarantined = items.filter((item) => item.title.trim() && !normalizeArticleUrl(item.articleUrl));
  const relevant = [...valid, ...quarantined].filter((item) => !source.filterAI || isAiRelevant(`${plainText(item.title)} ${plainText(item.text)}`));
  const limited = relevant.slice(0, source.maxItems);
  const stale = valid.every((item) => !item.publishedAt || !Number.isFinite(Date.parse(item.publishedAt)) || started - Date.parse(item.publishedAt) > 30 * 86_400_000);
  return { ...base, status: 'ok', items: limited, samples: valid.slice(0, 3).map((item) => ({ title: plainText(item.title), url: item.articleUrl, publishedAt: item.publishedAt })), verificationStatus: 'verified', stale };
  } catch (error) {
    return { ...base, status: 'failed', items: [], samples: [], verificationStatus: 'failed', stale: false, durationMs: Date.now() - started,
      errorCode: error instanceof SourceFetchError ? error.code : 'parse-or-shape-error' };
  }
}

export async function fetchSource(source: SourceConfig): Promise<SourceProbeResult> {
  const started = Date.now();
  if (!source.enabled) return { sourceId: source.id, status: 'disabled', items: [], samples: [], durationMs: 0, fetchedAt: new Date().toISOString(), verificationStatus: 'failed', stale: false };
  try { return await readSource(source); }
  catch (error) {
    return { sourceId: source.id, status: 'failed', items: [], samples: [], durationMs: Date.now() - started,
      fetchedAt: new Date(started).toISOString(), errorCode: error instanceof SourceFetchError ? error.code : 'parse-or-shape-error',
      httpStatus: error instanceof SourceFetchError ? error.httpStatus : undefined,
      retryAfterMs: error instanceof SourceFetchError ? error.retryAfterMs : undefined, verificationStatus: 'failed', stale: false };
  }
}

export async function probeSource(source: SourceConfig): Promise<SourceProbeResult> {
  if (source.type === 'github-release') {
    const repository = new URL(source.url).pathname.replace(/\/releases\/?$/, '');
    const expected = repository.replace(/^\/repos\//, '').toLowerCase();
    try {
      const token = source.authEnv ? process.env[source.authEnv] : undefined;
      const response = await safeFetch(`https://api.github.com${repository}`, { timeoutMs: source.timeoutMs, authHost: 'api.github.com', headers: {
        Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', ...(token ? { Authorization: `Bearer ${token}` } : {}),
      } });
      if (response.status !== 200 || string(record(JSON.parse(response.text)).full_name).toLowerCase() !== expected) throw new SourceFetchError('github-repository-not-verified', response.status, retryAfterMilliseconds(response.headers['retry-after']));
    } catch (error) {
      return { sourceId: source.id, status: 'failed', items: [], samples: [], fetchedAt: new Date().toISOString(), durationMs: 0,
        httpStatus: error instanceof SourceFetchError ? error.httpStatus : undefined, errorCode: error instanceof SourceFetchError ? error.code : 'github-repository-not-verified',
        retryAfterMs: error instanceof SourceFetchError ? error.retryAfterMs : undefined, verificationStatus: 'failed', stale: false };
    }
  }
  return fetchSource({ ...source, enabled: true, etag: null, lastModified: null });
}