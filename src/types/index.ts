export interface ArticleData {
  title: string;
  titleVi?: string;
  summaryVi: string;
  briefVi?: string;
  whyImportant?: string;
  contentVi?: string;
  sourceName: string;
  sourceUrl: string;
  originalUrl: string;
  originalTitle: string;
  originalPublishedAt?: Date;
  category: string;
  tags: string[];
  aiTags?: string[];
  targetAudience?: string;
  impactLevel?: string;
  importanceScore: number;
  reasonForScore: string;
  canonicalUrl?: string;
  duplicateOfId?: string | null;
  duplicateReason?: string;
  aiProvider?: string;
  aiModel?: string;
  aiStatus?: 'pending' | 'success' | 'failed' | 'blocked' | 'fallback_success';
  aiError?: string;
  aiProcessedAt?: Date | null;
  contentHash: string;
  slug: string;
  status: 'draft' | 'pending' | 'published' | 'rejected';
}

export interface CrawlerResult {
  sourceName: string;
  articles: ArticleData[];
  error?: string;
}

export interface AppSettings {
  publish_threshold: number;
  pending_threshold: number;
  cron_schedule: string;
  admin_username: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  app_base_url: string;
  max_publish_per_crawl: number;
  min_score_to_publish: number;
  max_repo_radar_ai_per_crawl: number;
  openrouter_model: string;
  openrouter_fallback_model: string;
  openrouter_second_fallback_model: string;
  ai_translation_enabled: boolean;
  ai_importance_reason_enabled: boolean;
  allow_publish_without_ai: boolean;
}

export interface AnalyticsStats {
  totalArticles: number;
  publishedArticles: number;
  pendingArticles: number;
  rejectedArticles: number;
  draftArticles: number;
  telegramSent: number;
  sourcesCount: number;
  lastCrawlRun: {
    id: string;
    startedAt: Date;
    status: string;
    totalFetched: number;
    totalPublished: number;
    totalRejected: number;
    totalPending: number;
  } | null;
  avgScore: number;
  topSources: { name: string; count: number }[];
  scoreDistribution: { range: string; count: number }[];
  articlesByDay: { day: string; count: number }[];
}

export interface ArticleSummary {
  slug: string;
  title: string;
  titleVi?: string;
  summaryVi: string;
  briefVi?: string;
  whyImportant?: string;
  sourceName: string;
  sourceUrl?: string;
  originalUrl?: string;
  status?: string;
  reasonForScore?: string;
  tags?: string;
  aiTags?: string;
  targetAudience?: string;
  impactLevel?: string;
  publishedAt?: string | null;
  category: string;
  importanceScore: number;
  createdAt: string;
}
