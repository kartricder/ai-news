import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

function cleanContent(value: string) {
  return value.replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export default async function ArticleDetailPage(props: PageProps<'/articles/[slug]'>) {
  const { slug } = await props.params;
  const article = await prisma.article.findFirst({
    where: { slug, status: 'published' },
  });

  if (!article) notFound();

  const tags = article.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  const sourceUrl = article.originalUrl || article.sourceUrl;
  const content = cleanContent(article.contentVi || article.briefVi || article.summaryVi);
  const displayTitle = article.titleVi || article.title;
  const displayBrief = article.briefVi || article.summaryVi;

  return (
    <article className="mx-auto max-w-3xl py-8">
      <Link href="/" className="text-sm font-medium text-sky-700 hover:text-sky-900">
        Quay lại trang chủ
      </Link>

      <header className="mt-6 border-b border-slate-200 pb-6">
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-md bg-sky-50 px-2 py-1 font-semibold text-sky-700">{article.category}</span>
          <span className="rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-700">
            Điểm {article.importanceScore}/100
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{article.sourceName}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-5xl">{displayTitle}</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">{displayBrief}</p>
        <div className="mt-5 grid gap-2 text-sm text-slate-500 md:grid-cols-2">
          <p>Published: {article.publishedAt ? article.publishedAt.toLocaleString('vi-VN') : 'N/A'}</p>
          <p>Fetched: {(article.fetchedAt || article.createdAt).toLocaleString('vi-VN')}</p>
        </div>
      </header>

      <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Vi sao quan trong</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{article.whyImportant || 'Chua co phan tich AI.'}</p>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Lý do chấm điểm</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{article.reasonForScore || 'Không có ghi chú.'}</p>
      </section>

      {tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-8 whitespace-pre-line text-base leading-8 text-slate-800">
        {content || displayBrief}
      </div>

      {sourceUrl && (
        <p className="mt-8 border-t border-slate-200 pt-5 text-sm">
          <a className="font-medium text-sky-700 hover:text-sky-900" href={sourceUrl} target="_blank" rel="noreferrer">
            Mở nguồn gốc
          </a>
        </p>
      )}
    </article>
  );
}
