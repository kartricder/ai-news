import { load } from 'cheerio';
import { safeFetch } from '../sources/fetch';
import { assessEvidence, normalizeNews, plainText } from './normalize';
import type { RawNewsItem } from './types';

export async function enrichCommunityItem(item: RawNewsItem, cache: Map<string, Promise<string | null>>): Promise<RawNewsItem> {
  const normalized = normalizeNews(item);
  if (assessEvidence(normalized).eligibleForAI || !normalized.canonicalUrl) return item;
  const url = new URL(normalized.canonicalUrl);
  if (/(^|\.)(reddit\.com|redd\.it|news\.ycombinator\.com)$/.test(url.hostname)) return item;
  let pending = cache.get(normalized.canonicalUrl);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await safeFetch(normalized.canonicalUrl);
        if (response.status !== 200 || !/text\/html/i.test(response.headers['content-type'] || '')) return null;
        const document = load(response.text);
        if (document('[data-paywall],.paywall,.subscription-wall,[itemprop="isAccessibleForFree"][content="false"]').length || /"isAccessibleForFree"\s*:\s*false/.test(response.text)) return null;
        const article = document('article').first();
        const description = document('meta[property="og:description"]').attr('content') || document('meta[name="description"]').attr('content') || '';
        const text = plainText(article.length ? article.html() || '' : description);
        return text.length > 0 ? text.slice(0, 30_000) : null;
      } catch { return null; }
    })();
    cache.set(normalized.canonicalUrl, pending);
  }
  const text = await pending;
  return text ? { ...item, text, evidenceLevel: text.length >= 1000 ? 'article' : 'snippet' }
    : { ...item, qualityFlags: [...(item.qualityFlags || []), 'enrichment-unavailable'] };
}