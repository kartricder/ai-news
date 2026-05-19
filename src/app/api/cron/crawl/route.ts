import { NextRequest, NextResponse } from 'next/server';
import { runCrawlPipeline } from '@/lib/pipeline/crawlPipeline';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const urlSecret = request.nextUrl.searchParams.get('secret');
  const headerSecret = request.headers.get('x-cron-secret');
  return urlSecret === secret || headerSecret === secret;
}

async function handleCron(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runCrawlPipeline();
    return NextResponse.json({
      success: true,
      crawlRunId: result.runId,
      fetched: result.fetched,
      candidates: result.candidates,
      published: result.published,
      pending: result.pending,
      rejected: result.rejected,
      duplicates: result.duplicates,
      aiSuccess: result.aiSuccess,
      aiFailed: result.aiFailed,
      telegramSent: result.telegramSent,
      repoRadarFound: result.repoRadarFound,
      errors: result.errors,
    });
  } catch (error) {
    console.error('cron crawl failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}
