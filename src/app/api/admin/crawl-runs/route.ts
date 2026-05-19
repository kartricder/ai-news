import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/authGuard';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const runs = await prisma.crawlRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ data: runs });
  } catch (error) {
    console.error('GET /api/admin/crawl-runs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
