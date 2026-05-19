import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/authGuard';

const allowedTypes = new Set(['rss', 'github', 'reddit', 'hackernews']);

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const sources = await prisma.source.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
  return NextResponse.json({ data: sources });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const type = typeof body?.type === 'string' ? body.type.trim() : 'rss';
    const url = typeof body?.url === 'string' ? body.url.trim() : '';

    if (!name || !url || !allowedTypes.has(type)) {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
    }

    const source = await prisma.source.create({
      data: { name, type, url, enabled: body?.enabled !== false },
    });

    return NextResponse.json({ data: source }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/sources error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
