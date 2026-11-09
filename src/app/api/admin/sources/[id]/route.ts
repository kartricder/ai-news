import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/authGuard';
import { toSourceConfig } from '@/lib/sources/catalog';
import type { Prisma } from '@prisma/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await prisma.source.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    const data: Prisma.SourceUpdateInput = {};
    const url = typeof body.url === 'string' ? body.url.trim() : existing.url;
    const configJson = typeof body.configJson === 'string' ? body.configJson : existing.configJson;
    const changed = url !== existing.url || configJson !== existing.configJson;
    try { toSourceConfig({ ...existing, url, configJson }); }
    catch { return NextResponse.json({ error: 'Invalid source URL or config' }, { status: 400 }); }

    if ('enabled' in body) {
      if (typeof body.enabled !== 'boolean') {
        return NextResponse.json({ error: 'Invalid enabled' }, { status: 400 });
      }
      data.enabled = body.enabled;
      if (body.enabled && (changed || existing.verificationStatus !== 'verified')) return NextResponse.json({ error: 'Probe source successfully before enabling' }, { status: 409 });
    }

    if ('url' in body) {
      if (typeof body.url !== 'string' || !body.url.trim()) {
        return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
      }
      data.url = body.url.trim();
    }

    if ('configJson' in body) {
      if (typeof body.configJson !== 'string') return NextResponse.json({ error: 'Invalid config' }, { status: 400 });
      data.configJson = configJson;
    }
    if (changed) Object.assign(data, { enabled: false, verificationStatus: 'unverified', verifiedAt: null, etag: null, lastModified: null,
      lastAttemptAt: null, lastSuccessAt: null, lastError: '', consecutiveFailures: 0, nextAttemptAt: null });

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const source = await prisma.source.update({ where: { id }, data });
    return NextResponse.json({ data: source });
  } catch (error) {
    console.error('PATCH /api/admin/sources/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
