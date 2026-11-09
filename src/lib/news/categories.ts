import type { NewsCategory } from './types';

export const newsCategories: NewsCategory[] = ['model-release', 'open-source', 'research', 'tool', 'business', 'security', 'policy', 'general'];

export function normalizeCategory(category: string | undefined, text = ''): NewsCategory {
  const mapped = category === 'tool-release' ? 'tool' : category === 'industry' ? 'business' : category;
  if (newsCategories.includes(mapped as NewsCategory)) return mapped as NewsCategory;
  if (/\b(cve-\d|vulnerability|security|exploit)\b|lỗ hổng|bảo mật/iu.test(text)) return 'security';
  if (/\b(regulation|legislation|policy|law|act)\b|chính sách|quy định/iu.test(text)) return 'policy';
  if (/\b(release|launch|introduc|unveil)/iu.test(text) && /\b(model|llm|weights)\b|mô hình/iu.test(text)) return 'model-release';
  if (/\b(arxiv|paper|research|study|abstract)\b|nghiên cứu/iu.test(text)) return 'research';
  if (/\b(acquisition|funding|investment|revenue|merger)\b|đầu tư/iu.test(text)) return 'business';
  if (/\b(open.source|open.weights)\b|mã nguồn mở/iu.test(text)) return 'open-source';
  if (/\b(tool|framework|library|sdk|agent)\b|công cụ/iu.test(text)) return 'tool';
  return 'general';
}

export function categoryAliases(category: string): string[] {
  if (!newsCategories.includes(category as NewsCategory) && !['tool-release', 'industry', 'breakthrough'].includes(category)) return [category];
  const normalized = normalizeCategory(category);
  const aliases: Record<string, string[]> = { tool: ['tool', 'tool-release'], business: ['business', 'industry'], general: ['general', 'breakthrough'] };
  return aliases[normalized] || [normalized];
}