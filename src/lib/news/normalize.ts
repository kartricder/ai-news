import { load } from 'cheerio';
import { fingerprintContent, normalizeArticleUrl } from './identity';
import type { NormalizedNewsItem, RawNewsItem } from './types';
import { normalizeCategory } from './categories';
export { normalizeCategory, categoryAliases } from './categories';

export function plainText(value: string): string {
  const document = load(value);
  document('script,style,nav,header,footer,aside,noscript,svg,iframe,form').remove();
  document('br,p,div,li,h1,h2,h3,h4,section').append(' ');
  return document.root().text().normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

export function isAiRelevant(text: string): boolean {
  return /\b(ai|artificial intelligence|machine learning|deep learning|llms?|language models?|neural networks?|inference|transformers?|diffusion|generative|embeddings?|fine.tuning|openai|anthropic|deepmind|vllm|llama|claude|gpt|gemini|qwen|mistral|deepseek)\b|trí tuệ nhân tạo|học máy|mô hình ngôn ngữ/iu.test(text);
}

export function normalizeNews(item: RawNewsItem): NormalizedNewsItem {
  const title = plainText(item.title);
  const text = plainText(item.text);
  const flags = new Set(item.qualityFlags || []);
  const canonicalUrl = normalizeArticleUrl(item.articleUrl) || '';
  if (!canonicalUrl) flags.add('missing-article-url');
  const fetched = Date.parse(item.fetchedAt);
  if (!Number.isFinite(fetched)) flags.add('invalid-fetched-date');
  const published = item.publishedAt ? Date.parse(item.publishedAt) : NaN;
  if (!item.publishedAt) flags.add('missing-date');
  else if (!Number.isFinite(published)) flags.add('invalid-date');
  else if (published - fetched > 86_400_000) flags.add('future-date');
  else if (fetched - published > 30 * 86_400_000) flags.add('stale-date');
  const titleWords = new Set(title.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const novelWords = words.filter((word) => !titleWords.has(word));
  let evidenceLevel = item.evidenceLevel;
  if (!text || text.toLowerCase() === title.toLowerCase() || novelWords.length < 8) {
    flags.add('title-only');
    evidenceLevel = 'title_only';
  } else if (text.replace(/\s/gu, '').length < 160 || new Set(words).size < 16 || novelWords.length < 16) flags.add('insufficient-evidence');
  if (/\b(rumou?r|unconfirmed|speculat(?:ion|e|ive)|reportedly|allegedly)\b|tin đồn|chưa xác nhận/iu.test(`${title} ${text}`)) flags.add('unconfirmed-claim');
  if (/ignore (all|previous)|system prompt|developer message|bỏ qua.*chỉ dẫn/iu.test(text)) flags.add('source-instruction');
  const language = item.language || (/[ăâđêôơưĂÂĐÊÔƠƯ]/u.test(`${title} ${text}`) ? 'vi' : null);
  return {
    ...item, title, text, originalText: text, canonicalUrl, language, evidenceLevel,
    publishedAt: Number.isFinite(published) ? new Date(published).toISOString() : null,
    fingerprint: fingerprintContent(title, text), category: normalizeCategory(item.category, `${title} ${text}`), qualityFlags: [...flags],
  };
}

export function assessEvidence(item: NormalizedNewsItem): { eligibleForAI: boolean; requiresReview: boolean; reasons: string[] } {
  const reasons = [...item.qualityFlags];
  if (item.evidenceLevel === 'title_only' && !reasons.includes('title-only')) reasons.push('title-only');
  if (item.originalText.replace(/\s/gu, '').length < 160 && !reasons.includes('insufficient-evidence')) reasons.push('insufficient-evidence');
  const insufficient = ['title-only', 'insufficient-evidence', 'missing-article-url', 'source-instruction'];
  return { eligibleForAI: !reasons.some((reason) => insufficient.includes(reason)), requiresReview: reasons.length > 0, reasons };
}