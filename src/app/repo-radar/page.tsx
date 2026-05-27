import { prisma } from '@/lib/prisma';
import EmptyState from '@/components/ui/EmptyState';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Repo Radar — AI News Việt Nam',
  description: 'Theo dõi các GitHub repository AI đang được cộng đồng chú ý, xếp hạng theo điểm repo và độ tích cực.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export default async function RepoRadarPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const langFilter = params.lang || '';
  const sort = params.sort || 'repoScore';

  const orderBy =
    sort === 'stars'
      ? [{ stars: 'desc' as const }]
      : sort === 'updated'
      ? [{ lastPushedAt: 'desc' as const }]
      : [{ repoScore: 'desc' as const }, { stars: 'desc' as const }];

  const repos = await prisma.repoRadarItem.findMany({
    where: {
      status: { in: ['tracked', 'published'] },
      ...(langFilter ? { language: langFilter } : {}),
    },
    orderBy,
    take: 60,
  });

  // Language list for filter
  const allLanguages = await prisma.repoRadarItem.groupBy({
    by: ['language'],
    where: { status: { in: ['tracked', 'published'] }, language: { not: '' } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 12,
  });

  const SORTS = [
    { value: 'repoScore', label: 'Điểm cao nhất' },
    { value: 'stars', label: 'Stars nhiều nhất' },
    { value: 'updated', label: 'Cập nhật gần nhất' },
  ];

  function formatStars(n: number) {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  }

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  function timeSince(date: Date | null) {
    if (!date) return 'N/A';
    const diff = now - date.getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return 'hôm nay';
    if (days < 30) return `${days} ngày trước`;
    if (days < 365) return `${Math.floor(days / 30)} tháng trước`;
    return `${Math.floor(days / 365)} năm trước`;
  }

  return (
    <div className="py-6 lg:py-8">
      {/* Page header */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-teal-50 border border-emerald-100 px-6 py-8 lg:px-10">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span>🔭</span>
            GitHub AI Tracker
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Repo Radar
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
            Các GitHub repository AI đang được cộng đồng chú ý — được xếp hạng theo điểm tổng hợp từ stars, forks và tốc độ phát triển.
          </p>
          <div className="mt-4 flex items-center gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {repos.length} repos đang theo dõi
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Language filter */}
        <div className="flex flex-wrap gap-1.5">
          <Link
            href="/repo-radar"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !langFilter
                ? 'bg-emerald-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            Tất cả
          </Link>
          {allLanguages.map((l) => (
            <Link
              key={l.language}
              href={`/repo-radar?lang=${encodeURIComponent(l.language)}${sort !== 'repoScore' ? `&sort=${sort}` : ''}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                langFilter === l.language
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              {l.language}
              <span className="ml-1 opacity-60">{l._count.id}</span>
            </Link>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-1.5">
          {SORTS.map((s) => (
            <Link
              key={s.value}
              href={`/repo-radar?sort=${s.value}${langFilter ? `&lang=${encodeURIComponent(langFilter)}` : ''}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                sort === s.value
                  ? 'bg-slate-800 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid */}
      {repos.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => {
            const topicList = (repo.topics || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 4);

            return (
              <a
                key={repo.id}
                href={repo.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">{repo.owner}</p>
                    <h3 className="mt-0.5 line-clamp-1 font-bold text-slate-900 group-hover:text-emerald-700">
                      {repo.repoName}
                    </h3>
                  </div>
                  <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    {repo.repoScore}
                  </span>
                </div>

                {/* Description */}
                <p className="mt-3 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500">
                  {repo.aiSummaryVi || repo.description || 'Chưa có mô tả.'}
                </p>

                {/* Why important */}
                {repo.whyImportant && (
                  <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                    <p className="line-clamp-2 text-xs leading-relaxed text-emerald-700">
                      💡 {repo.whyImportant}
                    </p>
                  </div>
                )}

                {/* Topics */}
                {topicList.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {topicList.map((t) => (
                      <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stats footer */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      {formatStars(repo.stars)}
                    </span>
                    {repo.forks > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        {formatStars(repo.forks)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {repo.language && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {repo.language}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {timeSince(repo.lastPushedAt)}
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="🔭"
          title="Chưa có repo nào"
          description="Repo Radar sẽ tự động cập nhật sau khi crawler chạy. Hãy thử lại sau."
          action={
            <Link href="/" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Về trang chủ
            </Link>
          }
        />
      )}
    </div>
  );
}
