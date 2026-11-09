import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/authGuard';
import { sourceTypes, toSourceConfig } from '@/lib/sources/catalog';

const allowedTypes = new Set<string>(sourceTypes);

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const sources = await prisma.source.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
  const data = await Promise.all(sources.map(async (source) => {
    const lastFetch = await prisma.sourceFetchLog.findFirst({ where: { sourceId: source.id }, orderBy: { fetchedAt: 'desc' },
      select: { status: true, httpStatus: true, errorCode: true, fetchedCount: true, fetchedAt: true, durationMs: true } });
    try { const config = toSourceConfig(source); return { ...source, publisherKey: config.publisherKey, kind: config.kind, language: config.language, lastFetch }; }
    catch { return { ...source, lastFetch }; }
  }));
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
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

    const configJson = typeof body.configJson === 'string' ? body.configJson : '{}';
    try { toSourceConfig({ id: 'new', name, type, url, enabled: false, configJson }); }
    catch { return NextResponse.json({ error: 'Invalid source URL or config' }, { status: 400 }); }

    const source = await prisma.source.create({
      data: { name, type, url, enabled: false, configJson },
    });

    return NextResponse.json({ data: source }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/sources error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
