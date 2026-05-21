import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';
import ScoreBadge, { getScoreConfig } from '@/components/ui/ScoreBadge';
import EmptyState from '@/components/ui/EmptyState';
import type { ArticleSummary } from '@/types';
import { prisma } from '@/lib/prisma';

interface ArticlesResponse {
  data: ArticleSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const CATEGORIES = [
  { value: '', label: 'Tất cả' },
  { value: 'model-release', label: 'Model AI' },
  { value: 'open-source', label: 'Open Source' },
  { value: 'research', label: 'Nghiên cứu' },
  { value: 'tool', label: 'Công cụ' },
  { value: 'business', label: 'Kinh doanh' },
  { value: 'security', label: 'Bảo mật' },
  { value: 'policy', label: 'Chính sách' },
];

async function getPublishedArticles(params: {
  page: number;
  search?: string;
  category?: string;
  sortBy?: string;
}): Promise<ArticlesResponse> {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const url = new URL('/api/articles', baseUrl);
  url.searchParams.set('status', 'published');
  url.searchParams.set('sortBy', params.sortBy || 'importanceScore');
  url.searchParams.set('sortOrder', 'desc');
  url.searchParams.set('page', String(params.page));
  url.searchParams.set('pageSize', '12');
  if (params.search) url.searchParams.set('search', params.search);
  if (params.category) url.searchParams.set('category', params.category);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch articles');
  return res.json();
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; category?: string; sortBy?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));
  const search = params.search?.trim() || '';
  const category = params.category?.trim() || '';
  const sortBy = params.sortBy || 'importanceScore';

  let response: ArticlesResponse = {
    data: [],
    pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
  };

  try {
    response = await getPublishedArticles({ page: currentPage, search, category, sortBy });
  } catch {
    response.data = [];
  }

  // Stats + sidebar data
  const [repoRadar, stats, topSources, recentCrawl] = await Promise.all([
    prisma.repoRadarItem.findMany({
      where: { status: { in: ['tracked', 'published'] } },
      orderBy: [{ repoScore: 'desc' }, { stars: 'desc' }],
      take: 6,
    }).catch(() => []),
    prisma.$transaction([
      prisma.article.count({ where: { status: 'published' } }),
      prisma.source.count({ where: { enabled: true } }),
      prisma.repoRadarItem.count({ where: { status: { in: ['tracked', 'published'] } } }),
    ]).catch(() => [0, 0, 0]),
    prisma.article.groupBy({
      by: ['sourceName'],
      where: { status: 'published' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }).catch(() => []),
    prisma.crawlRun.findFirst({ orderBy: { startedAt: 'desc' } }).catch(() => null),
  ]);

  const [publishedCount, sourceCount, repoCount] = stats as [number, number, number];

  // Featured = first article (sorted by score already)
  const featured = !search && !category && currentPage === 1 ? response.data[0] : null;
  const gridArticles = featured ? response.data.slice(1) : response.data;
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const isFiltered = Boolean(search || category);

  function buildUrl(overrides: Record<string, string | number>) {
    const p: Record<string, string> = {};
    if (search) p.search = search;
    if (category) p.category = category;
    if (sortBy !== 'importanceScore') p.sortBy = sortBy;
    Object.entries(overrides).forEach(([k, v]) => { if (v) p[k] = String(v); });
    const q = new URLSearchParams(p).toString();
    return q ? `/?${q}` : '/';
  }

  return (
    <div className="py-6 lg:py-8">
      {/* === HERO === */}
      {!isFiltered && currentPage === 1 && (
        <section className="mb-6 rounded-2xl bg-gradient-to-br from-sky-50 via-white to-indigo-50 border border-sky-100 px-6 py-8 lg:px-10 lg:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                Cập nhật liên tục
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
                Tin AI quan trọng,
                <br />
                <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">
                  được lọc tự động
                </span>
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-500 sm:text-base">
                Tổng hợp các model mới, repo nổi bật, xu hướng AI và thảo luận cộng đồng đáng chú ý — tự động chấm điểm và xếp hạng.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 lg:gap-4">
              <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-center shadow-sm">
                <p className="text-2xl font-extrabold text-slate-900">{publishedCount.toLocaleString()}</p>
                <p className="mt-0.5 text-xs text-slate-500">Bài xuất bản</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-center shadow-sm">
                <p className="text-2xl font-extrabold text-sky-600">{sourceCount}</p>
                <p className="mt-0.5 text-xs text-slate-500">Nguồn theo dõi</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-center shadow-sm">
                <p className="text-2xl font-extrabold text-indigo-600">{repoCount}</p>
                <p className="mt-0.5 text-xs text-slate-500">Repo Radar</p>
              </div>
            </div>
          </div>

          {recentCrawl && (
            <p className="mt-4 text-xs text-slate-400">
              Cập nhật gần nhất:{' '}
              <span className="font-medium text-slate-500">
                {recentCrawl.startedAt.toLocaleString('vi-VN')}
              </span>
              {' '}· Crawl {recentCrawl.totalFetched.toLocaleString()} bài
            </p>
          )}
        </section>
      )}

      {/* === FILTER BAR === */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.value}
              href={buildUrl({ category: cat.value, page: 1 })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                category === cat.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </div>

        {/* Sort + Search */}
        <div className="flex items-center gap-2">
          <form method="get" action="/" className="hidden sm:flex items-center gap-1.5">
            {category && <input type="hidden" name="category" value={category} />}
            <input
              name="search"
              defaultValue={search}
              placeholder="Tìm kiếm..."
              className="h-8 w-44 rounded-full border border-slate-200 bg-white pl-3 pr-3 text-xs text-slate-700 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </form>
          <select
            defaultValue={sortBy}
            className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-600 focus:border-sky-300 focus:outline-none"
          >
            <option value="importanceScore">Quan trọng nhất</option>
            <option value="createdAt">Mới nhất</option>
          </select>
          {isFiltered && (
            <Link href="/" className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 hover:bg-slate-200">
              × Xóa bộ lọc
            </Link>
          )}
        </div>
      </div>

      {/* === SEARCH RESULT HEADER === */}
      {search && (
        <p className="mb-4 text-sm text-slate-600">
          Kết quả tìm kiếm cho “<span className="font-semibold text-slate-900">{search}</span>”
          {' '}— {response.pagination.total} bài
        </p>
      )}

      <div className="flex gap-6">
        {/* === MAIN CONTENT === */}
        <div className="min-w-0 flex-1">
          {/* Featured article */}
          {featured && (
            <section className="mb-6">
              <FeaturedArticle article={featured} now={now} />
            </section>
          )}

          {/* Articles grid */}
          {gridArticles.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {gridArticles.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>

              {/* Pagination */}
              {response.pagination.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  {response.pagination.hasPrev && (
                    <Link
                      href={buildUrl({ page: currentPage - 1 })}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-sky-300 hover:text-sky-700"
                    >
                      ← Trang trước
                    </Link>
                  )}
                  <span className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
                    {currentPage} / {response.pagination.totalPages}
                  </span>
                  {response.pagination.hasNext && (
                    <Link
                      href={buildUrl({ page: currentPage + 1 })}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-sky-300 hover:text-sky-700"
                    >
                      Trang sau →
                    </Link>
                  )}
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon="📰"
              title="Chưa có bài nào"
              description={
                isFiltered
                  ? 'Không tìm thấy bài nào phù hợp. Thử thay đổi bộ lọc.'
                  : 'Chưa có bài nào được xuất bản. Hãy chạy crawler.'
              }
              action={
                isFiltered ? (
                  <Link href="/" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                    Xem tất cả bài viết
                  </Link>
                ) : undefined
              }
            />
          )}
        </div>

        {/* === SIDEBAR === */}
        <aside className="hidden w-64 shrink-0 xl:block">
          <div className="sticky top-20 flex flex-col gap-5">
            {/* Top scores */}
            {response.data.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Top điểm quan trọng</h3>
                <ul className="space-y-2">
                  {response.data.slice(0, 5).map((a) => (
                    <li key={a.slug}>
                      <Link href={`/articles/${a.slug}`} className="group flex items-start gap-2">
                        <ScoreBadge score={a.importanceScore} size="sm" />
                        <span className="line-clamp-2 text-xs leading-snug text-slate-600 group-hover:text-sky-700">
                          {a.titleVi || a.title}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sources */}
            {topSources.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Nguồn tin</h3>
                <ul className="space-y-1.5">
                  {topSources.map((s) => (
                    <li key={s.sourceName}>
                      <Link
                        href={buildUrl({ category: '', page: 1, search: s.sourceName })}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 hover:text-sky-700"
                      >
                        <span className="truncate">{s.sourceName}</span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                          {s._count.id}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Repo Radar mini */}
            {repoRadar.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Repo Radar</h3>
                  <Link href="/repo-radar" className="text-xs font-medium text-sky-600 hover:text-sky-700">
                    Xem thêm
                  </Link>
                </div>
                <ul className="space-y-2">
                  {repoRadar.slice(0, 4).map((repo) => (
                    <li key={repo.id}>
                      <a href={repo.url} target="_blank" rel="noreferrer" className="group flex items-start justify-between gap-2">
                        <span className="line-clamp-1 text-xs font-medium text-slate-700 group-hover:text-sky-700">
                          {repo.repoName}
                        </span>
                        <span className="shrink-0 text-xs text-amber-600">★ {(repo.stars / 1000).toFixed(repo.stars >= 1000 ? 1 : 0)}{repo.stars >= 1000 ? 'k' : ''}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* === REPO RADAR SECTION === */}
      {repoRadar.length > 0 && !isFiltered && currentPage === 1 && (
        <section className="mt-12">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Repo Radar</h2>
              <p className="mt-0.5 text-sm text-slate-500">Repo AI đang được cộng đồng chú ý</p>
            </div>
            <Link
              href="/repo-radar"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-sky-300 hover:text-sky-700"
            >
              Xem tất cả →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {repoRadar.map((repo) => (
              <a
                key={repo.id}
                href={repo.url}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="line-clamp-1 font-semibold text-sm text-slate-900 group-hover:text-sky-700">
                    {repo.fullName}
                  </h3>
                  <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {repo.repoScore}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500">
                  {repo.aiSummaryVi || repo.description || 'Chưa có mô tả.'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-400">
                  <span>★ {repo.stars.toLocaleString()}</span>
                  {repo.forks > 0 && <span>⑂ {repo.forks.toLocaleString()}</span>}
                  {repo.language && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{repo.language}</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// === Featured Article Card ===
function FeaturedArticle({ article, now }: { article: ArticleSummary; now: number }) {
  const cfg = getScoreConfig(article.importanceScore);
  const tags = (article.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 4);
  const dateStr = article.publishedAt || article.createdAt;
  const diff = Math.max(0, now - new Date(dateStr).getTime());
  const hrs = Math.floor(diff / 3600000);
  const timeStr = hrs < 1 ? 'vừa xong' : hrs < 24 ? `${hrs} giờ trước` : `${Math.floor(hrs / 24)} ngày trước`;

  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group block rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-sky-200 hover:shadow-lg overflow-hidden"
    >
      <div className={`h-1 w-full ${
        article.importanceScore >= 85 ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
        : article.importanceScore >= 75 ? 'bg-gradient-to-r from-amber-400 to-orange-400'
        : 'bg-gradient-to-r from-sky-400 to-indigo-400'
      }`} />
      <div className="p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
            🔥 Tin nổi bật
          </span>
          <ScoreBadge score={article.importanceScore} showLabel size="md" />
          <span className="text-xs text-slate-400">{article.sourceName}</span>
        </div>

        <h2 className="text-lg font-bold leading-snug text-slate-900 group-hover:text-sky-700 sm:text-xl">
          {article.titleVi || article.title}
        </h2>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500 sm:line-clamp-3">
          {article.briefVi || article.summaryVi}
        </p>

        {article.whyImportant && (
          <div className={`mt-3 rounded-lg border ${cfg.border} ${cfg.bg} px-4 py-2.5`}>
            <p className={`text-sm font-medium ${cfg.text}`}>
              💡 {article.whyImportant}
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
                {tag}
              </span>
            ))}
          </div>
          <span className="text-xs text-slate-400">{timeStr}</span>
        </div>
      </div>
    </Link>
  );
}


