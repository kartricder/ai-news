import slugify from 'slugify';
import { fingerprintContent, normalizeArticleUrl } from './news/identity';

export function generateSlug(title: string): string {
  const base = slugify(title, {
    lower: true,
    strict: true,
    locale: 'vi',
    trim: true,
  });
  // Truncate to avoid overly long slugs
  return base.substring(0, 100);
}

export function generateContentHash(url: string, title: string): string {
  return fingerprintContent(title, normalizeArticleUrl(url) || url);
}

export function normalizeCanonicalUrl(url: string): string {
  return normalizeArticleUrl(url) || '';
}

export function normalizeTitleForDedupe(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleSimilarity(a: string, b: string): number {
  const aWords = new Set(normalizeTitleForDedupe(a).split(' ').filter(Boolean));
  const bWords = new Set(normalizeTitleForDedupe(b).split(' ').filter(Boolean));
  if (aWords.size === 0 || bWords.size === 0) return 0;
  let intersection = 0;
  for (const word of aWords) {
    if (bWords.has(word)) intersection++;
  }
  return intersection / Math.max(aWords.size, bWords.size);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (hours < 1) return 'Vài phút trước';
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
  return date.toLocaleDateString('vi-VN');
}

export function getStatusBadge(status: string): { label: string; color: string } {
  switch (status) {
    case 'published':
      return { label: 'Đã đăng', color: 'bg-green-100 text-green-800' };
    case 'pending':
      return { label: 'Chờ duyệt', color: 'bg-yellow-100 text-yellow-800' };
    case 'rejected':
      return { label: 'Từ chối', color: 'bg-red-100 text-red-800' };
    default:
      return { label: 'Nháp', color: 'bg-gray-100 text-gray-800' };
  }
}
