import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/authGuard';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    // Run all aggregations in parallel
    const [
      totalArticles,
      publishedArticles,
      pendingArticles,
      rejectedArticles,
      draftArticles,
      telegramSent,
      sourcesCount,
      avgScoreResult,
      lastCrawlRun,
      topSourcesRaw,
      articlesByDayRaw,
    ] = await Promise.all([
      prisma.article.count(),
      prisma.article.count({ where: { status: 'published' } }),
      prisma.article.count({ where: { status: 'pending' } }),
      prisma.article.count({ where: { status: 'rejected' } }),
      prisma.article.count({ where: { status: 'draft' } }),
      prisma.article.count({ where: { telegramSent: true } }),
      prisma.source.count({ where: { enabled: true } }),
      prisma.article.aggregate({
        _avg: { importanceScore: true },
      }),
      prisma.crawlRun.findFirst({
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          startedAt: true,
          status: true,
          totalFetched: true,
          totalPublished: true,
          totalRejected: true,
          totalPending: true,
        },
      }),
      prisma.article.groupBy({
        by: ['sourceName'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.$queryRawUnsafe<Array<{ day: string; count: bigint }>>(
        `SELECT DATE(createdAt) as day, COUNT(*) as count
         FROM Article
         WHERE createdAt >= datetime('now', '-30 days')
         GROUP BY DATE(createdAt)
         ORDER BY day ASC`
      ),
    ]);

    // Score distribution: count articles in score ranges
    const scoreRanges = [
      { label: '0-20', min: 0, max: 20 },
      { label: '21-40', min: 21, max: 40 },
      { label: '41-60', min: 41, max: 60 },
      { label: '61-80', min: 61, max: 80 },
      { label: '81-100', min: 81, max: 100 },
    ];

    const scoreDistribution = await Promise.all(
      scoreRanges.map(async ({ label, min, max }) => {
        const count = await prisma.article.count({
          where: {
            importanceScore: { gte: min, lte: max },
          },
        });
        return { range: label, count };
      })
    );

    return NextResponse.json({
      data: {
        totalArticles,
        publishedArticles,
        pendingArticles,
        rejectedArticles,
        draftArticles,
        telegramSent,
        sourcesCount,
        lastCrawlRun,
        avgScore: avgScoreResult._avg.importanceScore ?? 0,
        topSources: topSourcesRaw.map((s) => ({
          name: s.sourceName,
          count: s._count.id,
        })),
        scoreDistribution,
        articlesByDay: articlesByDayRaw.map((r) => ({
          day: r.day,
          count: Number(r.count),
        })),
      },
    });
  } catch (error) {
    console.error('GET /api/admin/stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
