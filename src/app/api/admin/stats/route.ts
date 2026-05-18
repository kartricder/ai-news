import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
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
      { label: '0-2', min: 0, max: 2 },
      { label: '3-5', min: 3, max: 5 },
      { label: '6-8', min: 6, max: 8 },
      { label: '9-10', min: 9, max: 10 },
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
