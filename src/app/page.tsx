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

async function getPublishedArticles(params: { page: number; search?: string; category?: string }): Promise<ArticlesResponse> {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const url = new URL('/api/articles', baseUrl);
  url.searchParams.set('status', 'published');
  url.searchParams.set('sortBy', 'importanceScore');
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
  searchParams: Promise<{ page?: string; search?: string; category?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));
  const search = params.search?.trim() || '';
  const category = params.category?.trim() || '';

  let response: ArticlesResponse = {
    data: [],
    pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
  };

  try {
    response = await getPublishedArticles({ page: currentPage, search, category });
  } catch {
    response.data = [];
  }

  return (
    <div className="flex flex-col gap-8 py-8">
      <section className="border-b border-slate-200 pb-8">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Tin tức AI đáng đọc hôm nay
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">
            Crawler tự động tổng hợp, chấm điểm và xuất bản các tin AI quan trọng từ blog, Hacker News, Reddit và GitHub.
          </p>
        </div>
      </section>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_220px_auto]">
        <input
          name="search"
          defaultValue={search}
          placeholder="Tìm theo tiêu đề, nguồn, tóm tắt"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        <input
          name="category"
          defaultValue={category}
          placeholder="Lọc category"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          Lọc tin
        </button>
      </form>

      {response.data.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {response.data.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>

          {response.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm">
              {response.pagination.hasPrev && (
                <Link className="rounded-md border border-slate-200 px-3 py-2" href={`/?page=${currentPage - 1}&search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`}>
                  Trước
                </Link>
              )}
              <span className="text-slate-500">
                Trang {currentPage}/{response.pagination.totalPages}
              </span>
              {response.pagination.hasNext && (
                <Link className="rounded-md border border-slate-200 px-3 py-2" href={`/?page=${currentPage + 1}&search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`}>
                  Sau
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-lg font-semibold text-slate-800">Chưa có bài published phù hợp.</p>
          <p className="mt-2 text-sm text-slate-500">Chạy crawler hoặc bỏ bộ lọc để xem thêm nội dung.</p>
        </div>
      )}
    </div>
  );
}
