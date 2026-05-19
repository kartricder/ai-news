import Link from 'next/link';
import type { ArticleSummary } from '@/types';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.max(0, now - date);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function tagList(tags?: string) {
  return (tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 3);
}

export default function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-slate-950 group-hover:text-sky-700">
          {article.title}
        </h3>
        <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
          {article.importanceScore}
        </span>
      </div>

      <p className="mb-4 line-clamp-3 text-sm leading-6 text-slate-600">
        {article.summaryVi}
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
          {article.category}
        </span>
        {tagList(article.tags).map((tag) => (
          <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span className="truncate">{article.sourceName}</span>
        <span>{timeAgo(article.publishedAt || article.createdAt)}</span>
      </div>
    </Link>
  );
}
