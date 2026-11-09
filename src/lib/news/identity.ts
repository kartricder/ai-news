import { createHash } from 'node:crypto';
import type { RawNewsItem } from './types';

export function normalizeArticleUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_/i.test(key) || ['fbclid', 'gclid', 'dclid', 'msclkid'].includes(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getIdentityKey(item: RawNewsItem): string | null {
  const canonicalUrl = normalizeArticleUrl(item.articleUrl);
  if (canonicalUrl) return `url:${canonicalUrl}`;
  if (item.sourceId.trim() && item.externalId?.trim()) {
    return `external:${JSON.stringify([item.sourceId.trim(), item.externalId.trim()])}`;
  }
  return null;
}

export function fingerprintContent(title: string, text: string): string {
  const normalized = [title, text].map((value) => value.normalize('NFKC').replace(/\s+/gu, ' ').trim());
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}