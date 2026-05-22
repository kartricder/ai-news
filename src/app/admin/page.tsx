import Link from 'next/link';
import { requireAdminPage } from '@/lib/authGuard';
import { prisma } from '@/lib/prisma';
import { getAppSettings } from '@/lib/settings';
import AdminLogoutButton from '@/components/AdminLogoutButton';

async function getStats() {
  const [
    totalArticles,
    publishedArticles,
    pendingArticles,
    rejectedArticles,
    sourcesCount,
    lastCrawlRun,
    settings,
  ] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: 'published' } }),
    prisma.article.count({ where: { status: 'pending' } }),
    prisma.article.count({ where: { status: 'rejected' } }),
    prisma.source.count({ where: { enabled: true } }),
    prisma.crawlRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    getAppSettings(),
  ]);

  return {
    totalArticles,
    publishedArticles,
    pendingArticles,
    rejectedArticles,
    sourcesCount,
    lastCrawlRun,
    telegramConfigured: Boolean(settings.telegram_bot_token && settings.telegram_chat_id),
  };
}

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const stats = await getStats();

  const cards = [
    ['Tổng bài', stats.totalArticles],
    ['Published', stats.publishedArticles],
    ['Pending', stats.pendingArticles],
    ['Rejected', stats.rejectedArticles],
    ['Nguồn bật', stats.sourcesCount],
    ['Telegram', stats.telegramConfigured ? 'Đã cấu hình' : 'Chưa cấu hình'],
  ];

  return (
    <div className="py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Admin dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Theo dõi crawler, bài viết, nguồn và Telegram.</p>
        </div>
        <AdminLogoutButton />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          ['/admin/articles', 'Bài viết'],
          ['/admin/analytics', 'Analytics'],
          ['/admin/sources', 'Nguồn crawl'],
          ['/admin/settings', 'Cài đặt'],
          ['/admin/telegram', 'Telegram'],
          ['/admin/crawl-logs', 'Crawl logs'],
          ['/admin/repo-radar', 'Repo Radar'],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
            {label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
        <h2 className="font-semibold text-slate-950">Crawl run gần nhất</h2>
        {stats.lastCrawlRun ? (
          <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-5">
            <span>{stats.lastCrawlRun.status}</span>
            <span>Fetched {stats.lastCrawlRun.totalFetched}</span>
            <span>Published {stats.lastCrawlRun.totalPublished}</span>
            <span>Pending {stats.lastCrawlRun.totalPending}</span>
            <span>{stats.lastCrawlRun.startedAt.toLocaleString('vi-VN')}</span>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Chưa có crawl run.</p>
        )}
      </section>
    </div>
  );
}
