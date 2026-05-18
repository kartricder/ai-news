import Link from 'next/link';
import StatusBadge from './StatusBadge';
import type { ArticleSummary } from '@/types';

interface ArticleCardProps {
  article: ArticleSummary;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

const categoryColors: Record<string, string> = {
  ai: 'bg-purple-500/10 text-purple-400 border-purple-600',
  'machine-learning': 'bg-blue-500/10 text-blue-400 border-blue-600',
  nlp: 'bg-emerald-500/10 text-emerald-400 border-emerald-600',
  'computer-vision': 'bg-orange-500/10 text-orange-400 border-orange-600',
  robotics: 'bg-rose-500/10 text-rose-400 border-rose-600',
  llm: 'bg-indigo-500/10 text-indigo-400 border-indigo-600',
  'open-source': 'bg-cyan-500/10 text-cyan-400 border-cyan-600',
  tools: 'bg-teal-500/10 text-teal-400 border-teal-600',
  research: 'bg-yellow-500/10 text-yellow-400 border-yellow-600',
  general: 'bg-zinc-500/10 text-zinc-400 border-zinc-600',
};

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    ai: 'AI',
    'machine-learning': 'ML',
    nlp: 'NLP',
    'computer-vision': 'CV',
    robotics: 'Robot',
    llm: 'LLM',
    'open-source': 'Mã nguồn mở',
    tools: 'Công cụ',
    research: 'Nghiên cứu',
    general: 'Tổng hợp',
  };
  return labels[cat] || cat;
}

export default function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group block rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-all hover:border-zinc-700 hover:bg-zinc-900"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug text-zinc-100 group-hover:text-cyan-400 transition-colors line-clamp-2">
          {article.title}
        </h3>
      </div>

      <p className="mb-3 text-sm leading-relaxed text-zinc-400 line-clamp-2">
        {article.summaryVi}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded border px-2 py-0.5 font-medium ${categoryColors[article.category] || categoryColors.general}`}>
          {categoryLabel(article.category)}
        </span>

        <span className="text-zinc-500">{article.sourceName}</span>

        {article.importanceScore >= 75 && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-400">
            ★ {article.importanceScore}
          </span>
        )}

        <span className="ml-auto text-zinc-600">{timeAgo(article.createdAt)}</span>
      </div>
    </Link>
  );
}
