import { eventTypeFor } from './rank';
import type { ClusterCandidate, NormalizedNewsItem } from './types';

export function eventKeyFor(item: NormalizedNewsItem): string | null {
  if (!item.publishedAt) return null;
  if (item.eventKey) return `${item.eventKey}:${item.externalVersion || 'event'}`;
  const entities = [...new Set((item.title.toLowerCase().match(/\b(openai|anthropic|google|deepmind|meta|nvidia|microsoft|aws|hugging\s?face|claude|gpt|llama|gemini|qwen|deepseek|mistral|vllm)\b/gu) || []))].sort();
  const vulnerabilities = [...new Set(item.title.toUpperCase().match(/\bCVE-\d{4}-\d{4,}\b/g) || [])].sort();
  if (vulnerabilities.length > 1) return null;
  if (vulnerabilities.length) return JSON.stringify(['security', vulnerabilities, item.publishedAt.slice(0, 10)]);
  const products = [...new Set(item.title.toLowerCase().match(/\b(?:claude|gpt|llama|gemini|qwen|deepseek|mistral|vllm)(?:[- ](?:\d+(?:\.\d+)*(?:[a-z]\d*)?|r\d+))(?:[- ](?:flash|pro|ultra|haiku|sonnet|opus|mini|nano|lite|max|instruct|chat|coder|preview|\d+b))*/gu) || [])].sort();
  const versions = [...new Set(item.title.toLowerCase().match(/\b(?:v?\d+(?:\.\d+)+(?:[a-z]\d*)?|(?:gpt|claude|llama|gemini|qwen|deepseek|mistral)[- ]\d+(?:\.\d+)*)\b/gu) || [])].sort();
  if (products.length > 1 || versions.length > 1) return null;
  const eventType = eventTypeFor(item);
  if (!entities.length || eventType === 'general' || (!products.length && !versions.length)) return null;
  return JSON.stringify([products.length ? products : entities, eventType, versions, item.publishedAt.slice(0, 10)]);
}

export function suggestCluster(item: NormalizedNewsItem, recent: ClusterCandidate[]): { clusterId: string | null; confidence: number; reasons: string[] } {
  const eventKey = eventKeyFor(item);
  if (!eventKey || !item.publishedAt) return { clusterId: null, confidence: 0, reasons: ['insufficient-event-identity'] };
  const matches = recent.filter((candidate) => candidate.item.publishedAt &&
    Math.abs(Date.parse(item.publishedAt!) - Date.parse(candidate.item.publishedAt)) <= 72 * 3_600_000 && eventKeyFor(candidate.item) === eventKey);
  const clusters = [...new Set(matches.map((candidate) => candidate.clusterId))];
  if (clusters.length !== 1) return { clusterId: null, confidence: 0, reasons: [clusters.length ? 'ambiguous-event-review' : 'no-event-match'] };
  return { clusterId: clusters[0], confidence: 0.85, reasons: ['same-entities-event-version-day', 'within-72-hours', 'suggestion-requires-editor-review'] };
}