export type NewsCategory = 'model-release' | 'open-source' | 'research' | 'tool'
  | 'business' | 'security' | 'policy' | 'general';

export type SourceKind = 'official' | 'research' | 'engineering' | 'media' | 'community';
export type EvidenceLevel = 'title_only' | 'snippet' | 'abstract' | 'article';

export type RawNewsItem = {
  sourceId: string;
  externalId?: string;
  sourceUrl: string;
  articleUrl: string;
  title: string;
  text: string;
  publishedAt: string | null;
  fetchedAt: string;
  language: string | null;
  evidenceLevel: EvidenceLevel;
  qualityFlags?: string[];
  category?: NewsCategory;
  eventKey?: string;
  externalVersion?: string;
  tags?: string[];
};

export type NormalizedNewsItem = RawNewsItem & {
  canonicalUrl: string;
  fingerprint: string;
  originalText: string;
  category: NewsCategory;
  qualityFlags: string[];
};

export type SourceFetchResult = {
  sourceId: string;
  status: 'ok' | 'not_modified' | 'failed' | 'disabled';
  items: RawNewsItem[];
  httpStatus?: number;
  errorCode?: string;
  durationMs: number;
  fetchedAt: string;
};

export type ScoreBreakdown = {
  relevance: number;
  impact: number;
  credibility: number;
  freshness: number;
  evidence: number;
  vietnamRelevance: number;
  penalty: number;
  total: number;
  reasons: string[];
  version: string;
};

export type RankingContext = {
  clock: Date;
  sourceKind: SourceKind;
  eventType?: string;
};
export type RankedCandidate = {
  item: NormalizedNewsItem;
  breakdown: ScoreBreakdown;
  publisherKey: string;
  sourceKind: SourceKind;
  eligibleForAI: boolean;
};
export type SelectionLimits = { limit: number; threshold: number; perPublisher: number; community: number };
export type ClusterCandidate = { clusterId: string; item: NormalizedNewsItem };