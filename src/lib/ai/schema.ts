import type { EvidenceLevel } from '../news/types';

export const AI_SCHEMA_VERSION = 'news-ai-schema-v1';
export const AI_PROMPT_VERSION = 'news-editor-v1';
export type AiArticleInput = {
  articleId?: string;
  originalTitle: string;
  originalText?: string;
  originalBrief?: string;
  evidenceLevel?: EvidenceLevel;
  sourceName: string;
  sourceUrl: string;
  category: string;
  tags: string[];
  policyFlags?: string[];
  translationEnabled?: boolean;
  reasonEnabled?: boolean;
  leaseOwner?: string;
};
export type AiClaim = { text: string; evidenceIds: string[] };
export type ArticleOutput = {
  titleVi: string; briefVi: string; whyImportant: string; aiTags: string[];
  targetAudience: 'developer' | 'manager' | 'business' | 'researcher' | 'security' | 'general';
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  claims: AiClaim[]; uncertainties: string[]; qualityFlags: string[]; languageNote?: string;
};
export type ValidatedAiResult = ArticleOutput & {
  provider: string; model: string; status: 'success' | 'fallback_success';
  promptVersion: string; schemaVersion: string; requiresReview: boolean;
};

export function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('schema-object-required');
  return value as Record<string, unknown>;
}
export function boundedText(value: unknown, maximum: number, required = true): string {
  if (!required && value === undefined) return '';
  if (typeof value !== 'string' || value.trim().length > maximum || (required && !value.trim())) throw new Error('schema-invalid-string');
  return value.trim();
}
export function textList(value: unknown, maximum: number, length = 200): string[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error('schema-invalid-array');
  return value.map((entry) => boundedText(entry, length));
}
export function parseArticleOutput(value: unknown, translation: boolean, reason: boolean): ArticleOutput {
  const json = objectValue(value);
  const audience = boundedText(json.targetAudience, 30);
  const impact = boundedText(json.impactLevel, 20);
  if (!['developer', 'manager', 'business', 'researcher', 'security', 'general'].includes(audience) || !['low', 'medium', 'high', 'critical'].includes(impact)) throw new Error('schema-invalid-enum');
  if (!Array.isArray(json.claims) || !json.claims.length || json.claims.length > 12) throw new Error('schema-invalid-claims');
  const claims = json.claims.map((entry) => {
    const claim = objectValue(entry);
    const evidenceIds = textList(claim.evidenceIds, 4, 40);
    if (!evidenceIds.length || evidenceIds.some((id) => !/^source-\d+$/.test(id))) throw new Error('schema-invalid-evidence-id');
    return { text: boundedText(claim.text, 800), evidenceIds };
  });
  const titleVi = boundedText(json.titleVi, 90, translation);
  const briefVi = boundedText(json.briefVi, 450, translation);
  const whyImportant = boundedText(json.whyImportant, 800, reason);
  return {
    titleVi: translation ? titleVi : '', briefVi: translation ? briefVi : '',
    whyImportant: reason ? whyImportant : '', aiTags: textList(json.aiTags, 8, 60),
    targetAudience: audience as ArticleOutput['targetAudience'], impactLevel: impact as ArticleOutput['impactLevel'], claims,
    uncertainties: textList(json.uncertainties, 8, 400), qualityFlags: textList(json.qualityFlags, 12, 100),
    languageNote: boundedText(json.languageNote, 200, false),
  };
}