export interface ArticleData {
  title: string;
  summaryVi: string;
  contentVi?: string;
  sourceName: string;
  sourceUrl: string;
  originalUrl: string;
  originalTitle: string;
  originalPublishedAt?: Date;
  category: string;
  tags: string[];
  importanceScore: number;
  reasonForScore: string;
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
  summaryVi: string;
  sourceName: string;
  sourceUrl?: string;
  originalUrl?: string;
  status?: string;
  reasonForScore?: string;
  tags?: string;
  publishedAt?: string | null;
  category: string;
  importanceScore: number;
  createdAt: string;
}
