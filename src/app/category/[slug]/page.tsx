import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleCard from '@/components/ArticleCard';
import EmptyState from '@/components/ui/EmptyState';
import { prisma } from '@/lib/prisma';
import type { ArticleSummary } from '@/types';

const PAGE_SIZE = 12;

const CATEGORIES: Record<string, { label: string; title: string; description: string }> = {
  'model-release': {
    label: 'Model AI mới',
    title: 'Model AI mới',
    description: 'Các model AI mới ra mắt và cập nhật đáng chú ý.',
  },
  research: {
    label: 'Nghiên cứu',
    title: 'Nghiên cứu AI',
    description: 'Nghiên cứu, paper và kết quả thực nghiệm về AI.',
  },
  tool: {
    label: 'Công cụ AI',
    title: 'Công cụ AI',
    description: 'Tools và ứng dụng AI mới cho công việc hằng ngày.',
  },
  policy: {
    label: 'Chính sách',
    title: 'Chính sách AI',
    description: 'Luật, quy định và chính sách mới quanh AI.',
  },
  'open-source': {
    label: 'Open Source',
    title: 'Open Source AI',
    description: 'Dự án AI mã nguồn mở đáng theo dõi.',
  },
  business: {
    label: 'Kinh doanh',
    title: 'Kinh doanh AI',
    description: 'Tin kinh doanh, đầu tư và thị trường AI.',
  },
  security: {
    label: 'Bảo mật AI',
    title: 'Bảo mật AI',
    description: 'An toàn, bảo mật và rủi ro kỹ thuật trong AI.',
  },
  general: {
    label: 'Tổng hợp',
    title: 'Tin AI tổng hợp',
    description: 'Các cập nhật AI tổng hợp đáng chú ý.',
  },
};

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

function categoryFor(slug: string) {
  return CATEGORIES[slug];
}

function toArticleSummary(article: {
  slug: string;
  title: string;
  titleVi: string;
  summaryVi: string;
  briefVi: string;
  whyImportant: string;
  sourceName: string;
  sourceUrl: string;
  originalUrl: string;
  category: string;
  tags: string;
  aiTags: string;
  targetAudience: string;
  impactLevel: string;
  importanceScore: number;
  publishedAt: Date | null;
  createdAt: Date;
}): ArticleSummary {
  return {
    ...article,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    createdAt: article.createdAt.toISOString(),
  };
}

export const revalidate = 300;

export function generateStaticParams() {
  return Object.keys(CATEGORIES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Pick<PageProps, 'params'>): Promise<Metadata> {
  const { slug } = await params;
  const category = categoryFor(slug);
  if (!category) return {};

  return {
    title: `${category.title} — AI News Việt Nam`,
    description: category.description,
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const category = categoryFor(slug);
  if (!category) notFound();

  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  const where = { status: 'published', category: slug };
  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: [{ importanceScore: 'desc' }, { publishedAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        slug: true,
        title: true,
        titleVi: true,
        summaryVi: true,
        briefVi: true,
        whyImportant: true,
        sourceName: true,
        sourceUrl: true,
        originalUrl: true,
        category: true,
        tags: true,
        aiTags: true,
        targetAudience: true,
        impactLevel: true,
        importanceScore: true,
        publishedAt: true,
        createdAt: true,
      },
    }),
    prisma.article.count({ where }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const summaries = articles.map(toArticleSummary);

  function pageHref(target: number) {
    return target <= 1 ? `/category/${slug}` : `/category/${slug}?page=${target}`;
  }

  return (
    <div className="py-6 lg:py-8">
      <nav className="mb-5 flex items-center gap-2 text-xs text-slate-400" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-sky-600">Trang chủ</Link>
        <span>/</span>
        <span className="text-slate-600">{category.label}</span>
      </nav>

      <div className="mb-7">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">{category.title}</h1>
        <p className="mt-2 text-sm text-slate-500">{total} bài · {category.description}</p>
      </div>

      {summaries.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map((article) => <ArticleCard key={article.slug} article={article} />)}
          </div>
          {totalPages > 1 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {page > 1 && (
                <Link href={pageHref(page - 1)} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                  ← Trang trước
                </Link>
              )}
              <span className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link href={pageHref(page + 1)} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                  Trang sau →
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title="Chưa có bài trong chuyên mục này"
          description="Các bài published phù hợp sẽ xuất hiện tại đây sau khi crawler cập nhật."
          action={
            <Link href="/" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Về trang chủ
            </Link>
          }
        />
      )}
    </div>
  );
}
