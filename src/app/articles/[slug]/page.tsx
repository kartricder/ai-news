import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ScoreBadge, { getScoreConfig } from '@/components/ui/ScoreBadge';
import BookmarkButton from '@/components/BookmarkButton';

type PageProps<TRoute extends string> = {
  params: Promise<Record<string, string>> & (TRoute extends `${string}[${infer P}]${string}` ? Record<P, string> : unknown);
};

function cleanContent(value: string) {
  return value.replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.max(0, now - date);
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return 'vừa xong';
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

export async function generateMetadata(props: PageProps<'/articles/[slug]'>) {
  const { slug } = await props.params;
  const article = await prisma.article.findFirst({ where: { slug, status: 'published' } });
  if (!article) return {};
  return {
    title: `${article.titleVi || article.title} | AI News VN`,
    description: article.briefVi || article.summaryVi,
  };
}

export default async function ArticleDetailPage(props: PageProps<'/articles/[slug]'>) {
  const { slug } = await props.params;
  const article = await prisma.article.findFirst({
    where: { slug, status: 'published' },
  });

  if (!article) notFound();

  const tags = article.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  const aiTags = (article.aiTags || '').split(',').map((t) => t.trim()).filter(Boolean);
  const sourceUrl = article.originalUrl || article.sourceUrl;
  const content = cleanContent(article.contentVi || article.briefVi || article.summaryVi);
  const displayTitle = article.titleVi || article.title;
  const displayBrief = article.briefVi || article.summaryVi;
  const cfg = getScoreConfig(article.importanceScore);
  const categoryLabel = CATEGORY_LABELS[article.category] || article.category;
  const dateStr = article.publishedAt ?? article.fetchedAt ?? article.createdAt;

  // Related articles (same category)
  const related = await prisma.article.findMany({
    where: { status: 'published', category: article.category, slug: { not: slug } },
    orderBy: { importanceScore: 'desc' },
    take: 3,
    select: { slug: true, title: true, titleVi: true, importanceScore: true, sourceName: true, publishedAt: true, createdAt: true },
  });

  return (
    <div className="py-6 lg:py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-slate-400" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-sky-600">Trang chủ</Link>
        <span>/</span>
        <Link href={`/?category=${article.category}`} className="hover:text-sky-600">{categoryLabel}</Link>
        <span>/</span>
        <span className="line-clamp-1 text-slate-600">{displayTitle}</span>
      </nav>

      <div className="mx-auto max-w-3xl">
        {/* Score accent bar */}
        <div className={`mb-6 h-1 w-full rounded-full ${
          article.importanceScore >= 85 ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
          : article.importanceScore >= 75 ? 'bg-gradient-to-r from-amber-400 to-orange-400'
          : 'bg-gradient-to-r from-sky-400 to-indigo-400'
        }`} />

        {/* Header */}
        <header>
          {/* Meta badges */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              {categoryLabel}
            </span>
            <ScoreBadge score={article.importanceScore} showLabel size="md" />
            {article.impactLevel && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
                {article.impactLevel}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-3xl">
            {displayTitle}
          </h1>

          <p className="mt-3 text-base leading-relaxed text-slate-600">{displayBrief}</p>

          {/* Source + date row */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6" />
              </svg>
              <span className="font-medium text-slate-700">{article.sourceName}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {timeAgo(dateStr.toISOString())}
            </span>
            {article.targetAudience && (
              <span className="text-xs text-slate-400">Đối tượng: {article.targetAudience}</span>
            )}
          </div>

          <div className="mt-4">
            <BookmarkButton
              article={{
                slug: article.slug,
                title: article.title,
                titleVi: article.titleVi,
                briefVi: article.briefVi || article.summaryVi,
                sourceName: article.sourceName,
                importanceScore: article.importanceScore,
                publishedAt: article.publishedAt?.toISOString() ?? null,
              }}
            />
          </div>
        </header>

        {/* Why Important */}
        {article.whyImportant && (
          <div className={`mt-6 rounded-xl border ${cfg.border} ${cfg.bg} p-5`}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg">💡</span>
              <h2 className={`text-sm font-bold uppercase tracking-wide ${cfg.text}`}>
                Vì sao tin này quan trọng
              </h2>
            </div>
            <p className={`text-sm leading-relaxed ${cfg.text}`}>{article.whyImportant}</p>
          </div>
        )}

        {/* Reason for score */}
        {article.reasonForScore && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Lý do chấm điểm {article.importanceScore}/100
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">{article.reasonForScore}</p>
          </div>
        )}

        {/* Tags */}
        {(tags.length > 0 || aiTags.length > 0) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {tag}
              </span>
            ))}
            {aiTags.filter((t) => !tags.includes(t)).map((tag) => (
              <span key={tag} className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <div className="prose prose-slate prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-line">
            {content || displayBrief}
          </div>
        </div>

        {/* Source link */}
        {sourceUrl && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Nguồn gốc</p>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="group flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span className="break-all group-hover:underline">{sourceUrl}</span>
            </a>
          </div>
        )}

        {/* Back link */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-sky-300 hover:text-sky-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Quay lại trang chủ
          </Link>
        </div>
      </div>

      {/* Related articles */}
      {related.length > 0 && (
        <section className="mt-12 border-t border-slate-200 pt-8">
          <h2 className="mb-5 text-lg font-bold text-slate-900">Tin liên quan</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((a) => (
              <Link
                key={a.slug}
                href={`/articles/${a.slug}`}
                className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-sky-200 hover:shadow-md"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <ScoreBadge score={a.importanceScore} size="sm" />
                  <span className="text-xs text-slate-400">{timeAgo((a.publishedAt ?? a.createdAt).toISOString())}</span>
                </div>
                <h3 className="line-clamp-2 text-sm font-semibold text-slate-800 group-hover:text-sky-700">
                  {a.titleVi || a.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500">{a.sourceName}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
