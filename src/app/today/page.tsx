import type { Metadata } from 'next';
import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';
import EmptyState from '@/components/ui/EmptyState';
import { prisma } from '@/lib/prisma';
import type { ArticleSummary } from '@/types';

export const metadata: Metadata = {
  title: 'Tốt nhất hôm nay — AI News Việt Nam',
  description: 'Top tin tức AI quan trọng nhất trong 24h qua.',
};

export const revalidate = 300;

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

export default async function TodayPage() {
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const articles = await prisma.article.findMany({
    where: { status: 'published', publishedAt: { gte: since } },
    orderBy: [{ importanceScore: 'desc' }, { publishedAt: 'desc' }],
    take: 10,
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
  });
  const summaries = articles.map(toArticleSummary);

  return (
    <div className="py-6 lg:py-8">
      <div className="mb-7">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Tốt nhất hôm nay</h1>
        <p className="mt-2 text-sm text-slate-500">
          Top 10 tin AI quan trọng nhất trong 24h qua · Cập nhật {new Date().toLocaleDateString('vi-VN')} · {summaries.length} bài
        </p>
      </div>

      {summaries.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map((article) => <ArticleCard key={article.slug} article={article} />)}
          </div>
          <Link href="/" className="mt-7 inline-flex text-sm font-medium text-sky-700 hover:text-sky-800">
            ← Xem tất cả bài
          </Link>
        </>
      ) : (
        <EmptyState
          title="Hôm nay chưa có bài mới"
          description="Chưa có bài published trong 24h qua. Xem toàn bộ bài để đọc các cập nhật gần nhất."
          action={
            <Link href="/" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Xem tất cả bài
            </Link>
          }
        />
      )}
    </div>
  );
}
