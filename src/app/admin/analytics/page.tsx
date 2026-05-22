import Link from 'next/link';
import { requireAdminPage } from '@/lib/authGuard';
import { prisma } from '@/lib/prisma';

const SCORE_RANGES = [
  { label: '0-20', min: 0, max: 20 },
  { label: '21-40', min: 21, max: 40 },
  { label: '41-60', min: 41, max: 60 },
  { label: '61-80', min: 61, max: 80 },
  { label: '81-100', min: 81, max: 100 },
] as const;

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function Bar({ value, total }: { value: number; total: number }) {
  const width = percent(value, total);

  return (
    <div className="h-2 min-w-28 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-sky-500" style={{ width: `${width}%` }} />
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  await requireAdminPage();

  const [
    totalArticles,
    publishedArticles,
    telegramSent,
    averageScore,
    articlesByDayRaw,
    topSourcesRaw,
    scoreDistribution,
  ] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: 'published' } }),
    prisma.article.count({ where: { telegramSent: true } }),
    prisma.article.aggregate({ _avg: { importanceScore: true } }),
    prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
      SELECT DATE(createdAt) AS day, COUNT(*) AS count
      FROM Article
      WHERE createdAt >= datetime('now', '-14 days')
      GROUP BY DATE(createdAt)
      ORDER BY day ASC
    `,
    prisma.article.groupBy({
      by: ['sourceName'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    Promise.all(
      SCORE_RANGES.map(async (range) => ({
        range: range.label,
        count: await prisma.article.count({
          where: { importanceScore: { gte: range.min, lte: range.max } },
        }),
      }))
    ),
  ]);

  const articlesByDay = articlesByDayRaw.map((item) => ({
    day: item.day,
    count: Number(item.count),
  }));
  const maxDailyCount = Math.max(...articlesByDay.map((item) => item.count), 0);
  const maxSourceCount = Math.max(...topSourcesRaw.map((item) => item._count.id), 0);
  const cards = [
    { label: 'Tổng bài', value: totalArticles.toLocaleString('vi-VN') },
    {
      label: 'Published',
      value: `${publishedArticles.toLocaleString('vi-VN')} (${percent(publishedArticles, totalArticles)}%)`,
    },
    { label: 'Điểm TB', value: (averageScore._avg.importanceScore ?? 0).toFixed(1) },
    { label: 'Telegram', value: `${telegramSent.toLocaleString('vi-VN')} bài` },
  ];

  return (
    <div className="py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-950">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Theo dõi hiệu suất crawler, điểm bài viết và nguồn tin.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Bài viết mới trong 14 ngày</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Ngày</th>
                <th className="px-5 py-3">Bài</th>
                <th className="px-5 py-3">Tỷ lệ</th>
              </tr>
            </thead>
            <tbody>
              {articlesByDay.length > 0 ? articlesByDay.map((item) => (
                <tr key={item.day} className="border-t border-slate-100">
                  <td className="px-5 py-3 text-slate-700">{item.day}</td>
                  <td className="px-5 py-3 font-medium text-slate-950">{item.count}</td>
                  <td className="px-5 py-3"><Bar value={item.count} total={maxDailyCount} /></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="px-5 py-5 text-sm text-slate-500">Chưa có bài viết gần đây.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-950">Phân bố điểm quan trọng</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Khoảng</th>
                  <th className="px-5 py-3">Số bài</th>
                  <th className="px-5 py-3">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {scoreDistribution.map((item) => (
                  <tr key={item.range} className="border-t border-slate-100">
                    <td className="px-5 py-3 text-slate-700">{item.range}</td>
                    <td className="px-5 py-3 font-medium text-slate-950">
                      {item.count} ({percent(item.count, totalArticles)}%)
                    </td>
                    <td className="px-5 py-3"><Bar value={item.count} total={totalArticles} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-950">Top nguồn crawl</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Nguồn</th>
                  <th className="px-5 py-3">Số bài</th>
                  <th className="px-5 py-3">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {topSourcesRaw.length > 0 ? topSourcesRaw.map((item) => (
                  <tr key={item.sourceName} className="border-t border-slate-100">
                    <td className="px-5 py-3 text-slate-700">{item.sourceName}</td>
                    <td className="px-5 py-3 font-medium text-slate-950">{item._count.id}</td>
                    <td className="px-5 py-3"><Bar value={item._count.id} total={maxSourceCount} /></td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="px-5 py-5 text-sm text-slate-500">Chưa có nguồn dữ liệu.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Link href="/admin" className="mt-6 inline-flex text-sm font-medium text-sky-700 hover:text-sky-800">
        ← Về dashboard
      </Link>
    </div>
  );
}
