import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runCrawlPipeline } from '@/lib/pipeline/crawlPipeline';
import { requireAdminApi } from '@/lib/authGuard';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await runCrawlPipeline();
    return NextResponse.json({
      data: {
        runId: result.runId,
        totalFetched: result.fetched,
        totalCandidates: result.candidates,
        totalPublished: result.published,
        totalPending: result.pending,
        totalRejected: result.rejected,
        totalDuplicates: result.duplicates,
        aiSuccess: result.aiSuccess,
        aiFailed: result.aiFailed,
        telegramSent: result.telegramSent,
        repoRadarFound: result.repoRadarFound,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error('POST /api/crawl/trigger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const runs = await prisma.crawlRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ data: runs });
  } catch (error) {
    console.error('GET /api/crawl/trigger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
