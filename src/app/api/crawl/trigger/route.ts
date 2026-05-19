import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runAllCrawlers } from '@/crawlers';
import { requireAdminApi } from '@/lib/authGuard';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await runAllCrawlers();
    return NextResponse.json({
      data: {
        runId: result.runId,
        totalFetched: result.total.fetched,
        totalPublished: result.total.published,
        totalPending: result.total.pending,
        totalRejected: result.total.rejected,
        totalDuplicates: result.total.duplicates,
        errors: result.total.errors,
        details: result.details,
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
