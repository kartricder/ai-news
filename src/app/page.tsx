import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';
import type { ArticleSummary } from '@/types';

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

async function getPublishedArticles(
  page: number = 1,
  pageSize: number = 12
): Promise<ArticlesResponse> {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const url = new URL('/api/articles', baseUrl);
  url.searchParams.set('status', 'published');
  url.searchParams.set('sortBy', 'importanceScore');
  url.searchParams.set('sortOrder', 'desc');
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));

  const res = await fetch(url.toString(), { cache: 'no-store' });

  if (!res.ok) {
    throw new Error('Failed to fetch articles');
  }

  return res.json();
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));
  let articles: ArticlesResponse['data'] = [];
  let pagination: ArticlesResponse['pagination'] = {
    page: 1,
    pageSize: 12,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  };

  try {
    const response = await getPublishedArticles(currentPage, 12);
    articles = response.data;
    pagination = response.pagination;
  } catch {
    // API not ready or no data — show empty state
  }

  // Build page numbers for navigation
  const buildPages = () => {
    if (pagination.totalPages <= 1) return [];
    const pages: (number | '...')[] = [];
    const delta = 2;
    for (let i = 1; i <= pagination.totalPages; i++) {
      if (
        i === 1 ||
        i === pagination.totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  };

  const pageNumbers = buildPages();

  return (
    <div className="flex flex-col gap-6">
      {/* Hero / Header */}
      <section className="py-8 md:py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Tin tức AI
        </h1>
        <p className="mt-2 text-lg text-[var(--foreground)]/60">
          Tổng hợp tin tức công nghệ trí tuệ nhân tạo mới nhất
        </p>
      </section>

      {/* Articles Grid */}
      {articles.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>

          {/* Pagination */}
          {pageNumbers.length > 0 && (
            <div className="flex items-center justify-center gap-1 py-4">
              {currentPage > 1 && (
                <Link
                  href={`/?page=${currentPage - 1}`}
                  className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                >
                  ‹ Trước
                </Link>
              )}

              {pageNumbers.map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-zinc-600">
                    ...
                  </span>
                ) : (
                  <Link
                    key={p}
                    href={`/?page=${p}`}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      p === currentPage
                        ? 'bg-cyan-500/15 text-cyan-400'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {p}
                  </Link>
                )
              )}

              {currentPage < pagination.totalPages && (
                <Link
                  href={`/?page=${currentPage + 1}`}
                  className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                >
                  Sau ›
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg
            className="mb-4 h-16 w-16 text-[var(--foreground)]/20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <p className="text-lg font-medium">Chưa có bài viết nào</p>
          <p className="mt-1 text-sm text-[var(--foreground)]/50">
            Các bài viết sẽ được hiển thị ở đây sau khi được xuất bản.
          </p>
        </div>
      )}
    </div>
  );
}
