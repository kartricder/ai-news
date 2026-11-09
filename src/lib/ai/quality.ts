import type { AiArticleInput, ArticleOutput } from './schema';

export function assessAiQuality(input: AiArticleInput, output: ArticleOutput): { requiresReview: boolean; flags: string[] } {
  const flags = new Set([...(input.policyFlags || []), ...output.qualityFlags]);
  const source = `${input.originalTitle} ${input.originalText || input.originalBrief || ''}`.normalize('NFKC').toLowerCase();
  const generated = [output.titleVi, output.briefVi, output.whyImportant, ...output.claims.map((claim) => claim.text)].join(' ');
  const compact = (value: string) => value.replace(/\s+/gu, '').replace(/,/g, '.').toLowerCase();
  for (const number of generated.match(/\d+(?:[.,]\d+)*(?:\s*%|\s*(?:usd|gb|tb|ms|tokens?|billion|million))?/giu) || []) {
    if (!compact(source).includes(compact(number))) flags.add('unsupported-number-or-unit');
  }
  for (const entity of generated.match(/\b(?:gpt|claude|llama|gemini|qwen|deepseek|mistral|openai|anthropic|nvidia|google|microsoft)(?:[- ]\d+(?:\.\d+)*)?\b/giu) || []) {
    if (!source.includes(entity.toLowerCase())) flags.add('unsupported-model-or-entity');
  }
  if (/https?:\/\//i.test(generated)) flags.add('generated-url');
  if (output.claims.some((claim) => claim.evidenceIds.some((id) => id !== 'source-1'))) flags.add('unknown-evidence-reference');
  if (/\b(rumou?r|unconfirmed|speculation|allegedly|reportedly)\b|tin đồn|chưa xác nhận/iu.test(source)) flags.add('unconfirmed-claim');
  if (/ignore (all|previous)|system prompt|developer message/iu.test(source)) flags.add('source-instruction');
  if (output.uncertainties.length) flags.add('editor-review-uncertainty');
  return { requiresReview: flags.size > 0, flags: [...flags] };
}