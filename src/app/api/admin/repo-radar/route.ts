import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/authGuard';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const items = await prisma.repoRadarItem.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ repoScore: 'desc' }, { stars: 'desc' }],
      take: 100,
    });
    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('GET /api/admin/repo-radar error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
