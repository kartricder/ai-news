import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/authGuard';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await request.json();
    const data: { enabled?: boolean; url?: string } = {};

    if ('enabled' in body) {
      if (typeof body.enabled !== 'boolean') {
        return NextResponse.json({ error: 'Invalid enabled' }, { status: 400 });
      }
      data.enabled = body.enabled;
    }

    if ('url' in body) {
      if (typeof body.url !== 'string' || !body.url.trim()) {
        return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
      }
      data.url = body.url.trim();
    }

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
