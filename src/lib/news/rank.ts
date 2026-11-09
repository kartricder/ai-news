import { assessEvidence, isAiRelevant } from './normalize';
import type { NormalizedNewsItem, RankedCandidate, RankingContext, ScoreBreakdown, SelectionLimits } from './types';

export const SCORE_VERSION = 'news-rank-v1';

export function eventTypeFor(item: Pick<NormalizedNewsItem, 'title' | 'originalText' | 'category'>): string {
  const text = `${item.title} ${item.originalText}`;
  if (item.category === 'security' && /\b(cve|vulnerab|exploit|patch)/iu.test(text)) return 'security';
  if (item.category === 'policy') return 'policy';
  if (/\b(release[ds]?|launch(?:ed|es)?|introduc(?:e[ds]?|ing)|unveil(?:ed|s)?)\b|ra mắt|phát hành/iu.test(text)) return 'release';
  if (item.category === 'research') return 'research';
  if (/\b(acqui(?:re|sition)|funding|investment|merger)\b/iu.test(text)) return 'business';
  if (/\b(benchmark|evaluat(?:ion|e)|accuracy|latency)\b/iu.test(text)) return 'benchmark';
  return 'general';
}

export function scoreNews(item: NormalizedNewsItem, context: RankingContext): ScoreBreakdown {
  const text = `${item.title} ${item.originalText}`;
  const technical = /\b(inference|training|weights|parameters|dataset|architecture|tokens?|latency|accuracy|llms?|language model|neural|diffusion)\b|huấn luyện|suy luận|mô hình ngôn ngữ/iu.test(text);
  const relevance = isAiRelevant(text) ? (technical ? 25 : 15) : 0;
  const eventType = context.eventType || eventTypeFor(item);
  const evidenceGate = assessEvidence(item);
  const impactByEvent: Record<string, number> = { release: 25, policy: 25, security: 25, research: 18, business: 15, benchmark: 15, general: 0 };
  const impact = evidenceGate.eligibleForAI && relevance ? impactByEvent[eventType] || 0 : 0;
  const credibility = { official: 15, research: 13, engineering: 13, media: 10, community: 5 }[context.sourceKind];
  const ageHours = item.publishedAt ? (context.clock.getTime() - Date.parse(item.publishedAt)) / 3_600_000 : NaN;
  const freshness = !Number.isFinite(ageHours) || ageHours < -24 || item.qualityFlags.includes('future-date') ? 0
    : ageHours <= 24 ? 15 : ageHours <= 72 ? 10 : ageHours <= 168 ? 5 : 0;
  const evidence = evidenceGate.eligibleForAI ? ({ title_only: 0, snippet: 8, abstract: 12, article: 15 }[item.evidenceLevel]) : 0;
  const vietnamRelevance = /việt nam|tiếng việt|\b(vietnam(?:ese)?|vinai|fpt)\b/iu.test(text) ? 5 : 0;
  let penalty = 0;
  const reasons = [`event:${eventType}`, `source:${context.sourceKind}`];
  for (const [pattern, points, reason] of [
    [/\b(sponsored|advertisement|promotion|buy now)\b/iu, 20, 'promotion'],
    [/\b(tutorial|beginner|how to|career|salary)\b/iu, 10, 'non-news'],
    [/\b(rumou?r|speculation|unconfirmed)\b|tin đồn/iu, 20, 'rumor'],
  ] as const) if (pattern.test(text)) { penalty += points; reasons.push(`penalty:${reason}`); }
  penalty = Math.min(40, penalty);
  reasons.push(`relevance:${relevance}`, `impact:${impact}`, `credibility:${credibility}`, `freshness:${freshness}`, `evidence:${evidence}`, `vietnam:${vietnamRelevance}`, ...evidenceGate.reasons.map((reason) => `review:${reason}`));
  if (context.sourceKind === 'official') reasons.push('vendor-claim-not-independent-confirmation');
  return { relevance, impact, credibility, freshness, evidence, vietnamRelevance, penalty,
    total: Math.max(0, Math.min(100, relevance + impact + credibility + freshness + evidence + vietnamRelevance - penalty)), reasons, version: SCORE_VERSION };
}

export function selectCandidates<Candidate extends RankedCandidate>(items: Candidate[], limits: SelectionLimits): Candidate[] {
  const ranked = [...items].sort((first, second) => second.breakdown.total - first.breakdown.total ||
    (Date.parse(second.item.publishedAt || '') || 0) - (Date.parse(first.item.publishedAt || '') || 0) || first.item.fingerprint.localeCompare(second.item.fingerprint));
  const publishers = new Map<string, number>();
  const selected: Candidate[] = [];
  let community = 0;
  for (const item of ranked) {
    if (selected.length >= Math.min(10, Math.max(0, limits.limit))) break;
    if (!item.eligibleForAI || item.breakdown.total < limits.threshold || assessEvidence(item.item).requiresReview) continue;
    if ((publishers.get(item.publisherKey) || 0) >= Math.max(0, Math.min(2, limits.perPublisher))) continue;
    if (item.sourceKind === 'community' && community >= Math.max(0, Math.min(3, limits.community))) continue;
    selected.push(item);
    publishers.set(item.publisherKey, (publishers.get(item.publisherKey) || 0) + 1);
    if (item.sourceKind === 'community') community++;
  }
  return selected;
}