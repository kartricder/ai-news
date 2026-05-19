import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/authGuard';

const statuses = new Set(['tracked', 'published', 'ignored']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const updateData: { status?: string; aiSummaryVi?: string; whyImportant?: string } = {};
    if ('status' in body) {
      if (typeof body.status !== 'string' || !statuses.has(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = body.status;
    }
    for (const field of ['aiSummaryVi', 'whyImportant'] as const) {
      if (field in body) {
        if (typeof body[field] !== 'string') {
          return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
        }
        updateData[field] = body[field].trim();
      }
    }

    const item = await prisma.repoRadarItem.update({ where: { id }, data: updateData });
    return NextResponse.json({ data: item });
  } catch (error) {
    console.error('PATCH /api/admin/repo-radar/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
