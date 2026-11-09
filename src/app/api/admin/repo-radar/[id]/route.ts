import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayloadFromRequest, requireAdminApi } from '@/lib/authGuard';
import type { Prisma } from '@prisma/client';

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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const updateData: Prisma.RepoRadarItemUpdateManyMutationInput = {};
    if ('status' in body) {
      if (typeof body.status !== 'string' || !statuses.has(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = body.status;
    }
    for (const field of ['aiSummaryVi', 'whyImportant'] as const) {
      if (field in body) {
        if (typeof body[field] !== 'string' || body[field].length > (field === 'aiSummaryVi' ? 350 : 700)) {
          return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
        }
        updateData[field] = body[field].trim();
      }
    }

    if (!Object.keys(updateData).length) return NextResponse.json({ error: 'No editable fields' }, { status: 400 });
    const before = await prisma.repoRadarItem.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
    Object.assign(updateData, { leaseOwner: null, leaseUntil: null, nextRetryAt: null });
    if ('aiSummaryVi' in body || 'whyImportant' in body) Object.assign(updateData, { aiStatus: 'review', aiError: 'admin-edited-repository-content' });
    const item = await prisma.$transaction(async (transaction) => {
      const changed = await transaction.repoRadarItem.updateMany({ where: { id, updatedAt: before.updatedAt }, data: updateData });
      if (!changed.count) return null;
      const after = await transaction.repoRadarItem.findUniqueOrThrow({ where: { id } });
      const snapshot = (value: typeof before) => ({ repoId: value.id, status: value.status, aiSummaryVi: value.aiSummaryVi, whyImportant: value.whyImportant, aiStatus: value.aiStatus });
      await transaction.adminAudit.create({ data: { actor: getAdminPayloadFromRequest(request)!.username, action: 'repo-edit', beforeJson: JSON.stringify(snapshot(before)), afterJson: JSON.stringify(snapshot(after)) } });
      return after;
    });
    if (!item) return NextResponse.json({ error: 'Repository changed; reload before editing' }, { status: 409 });
    return NextResponse.json({ data: item });
  } catch (error) {
    console.error('PATCH /api/admin/repo-radar/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
