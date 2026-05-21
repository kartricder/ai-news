import Link from 'next/link';
import type { ArticleSummary } from '@/types';
import ScoreBadge, { getScoreConfig } from '@/components/ui/ScoreBadge';

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.max(0, now - date);
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function tagList(tags?: string) {
  return (tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3);
}

const CATEGORY_LABELS: Record<string, string> = {
  'model-release': 'Model mới',
  'research': 'Nghiên cứu',
  'tool': 'Công cụ',
  'policy': 'Chính sách',
  'open-source': 'Open Source',
  'business': 'Kinh doanh',
  'security': 'Bảo mật',
  'general': 'Tổng hợp',
};

export default function ArticleCard({ article }: { article: ArticleSummary }) {
  const cfg = getScoreConfig(article.importanceScore);
  const tags = tagList(article.tags);
  const displayTitle = article.titleVi || article.title;
  const displayBrief = article.briefVi || article.summaryVi;
  const dateStr = article.publishedAt || article.createdAt;
  const categoryLabel = CATEGORY_LABELS[article.category] || article.category;

  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
    >
      {/* Score accent top bar */}
      <div className={`h-0.5 w-full rounded-t-xl ${article.importanceScore >= 85 ? 'bg-emerald-400' : article.importanceScore >= 75 ? 'bg-amber-400' : 'bg-sky-300'}`} />

      <div className="flex flex-1 flex-col p-4">
        {/* Header row: category + score */}
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            {categoryLabel}
          </span>
          <ScoreBadge score={article.importanceScore} />
        </div>

        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 group-hover:text-sky-700">
          {displayTitle}
        </h3>

        {/* Brief */}
        <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500">
          {displayBrief}
        </p>

        {/* Why important */}
        {article.whyImportant && (
          <div className={`mt-3 rounded-lg border ${cfg.border} ${cfg.bg} px-3 py-2`}>
            <p className={`line-clamp-2 text-xs leading-relaxed ${cfg.text}`}>
              💡 {article.whyImportant}
            </p>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer: source + date */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
            <svg className="h-3 w-3 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6 4h2" />
            </svg>
            <span className="truncate">{article.sourceName}</span>
          </span>
          <span className="shrink-0 text-xs text-slate-400">{timeAgo(dateStr)}</span>
        </div>
      </div>
    </Link>
  );
}
