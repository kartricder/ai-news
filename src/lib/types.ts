// ===== Prisma model types (subset used by frontend) =====

export interface ArticleSummary {
  id: string;
  title: string;
  titleVi?: string;
  slug: string;
  summaryVi: string;
  briefVi?: string;
  whyImportant?: string;
  sourceName: string;
  originalUrl: string;
  category: string;
  tags: string;
  aiTags?: string;
  targetAudience?: string;
  impactLevel?: string;
  importanceScore: number;
  reasonForScore: string;
  status: 'draft' | 'pending' | 'published' | 'rejected';
  aiStatus?: string;
  duplicateReason?: string;
  publishedAt: string | null;
  createdAt: string;
}

export interface ArticleDetail extends ArticleSummary {
  contentVi: string;
  sourceUrl: string;
  originalTitle: string;
  originalPublishedAt: string | null;
  fetchedAt: string;
  telegramSent: boolean;
  contentHash: string;
}

export interface SourceItem {
  id: string;
  name: string;
  type: string;
  url: string;
  enabled: boolean;
  configJson: string;
}

export interface CrawlRunItem {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  totalFetched: number;
  totalPublished: number;
  totalRejected: number;
  totalPending: number;
  errorMessage: string;
}

export interface AppSettingItem {
  id: string;
  key: string;
  value: string;
  encrypted: boolean;
}

export interface DashboardStats {
  totalArticles: number;
  publishedCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalSources: number;
  activeSources: number;
  lastCrawl: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ===== API request types =====

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  message?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface CrawlTriggerResponse {
  success: boolean;
  runId?: string;
  message: string;
}
