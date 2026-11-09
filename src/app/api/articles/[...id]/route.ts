import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayloadFromRequest, requireAdminApi } from '@/lib/authGuard';
import { normalizeCategory } from '@/lib/news/categories';
import type { Prisma } from '@prisma/client';

const allowedStatuses = new Set(['draft', 'pending', 'published', 'rejected']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string[] }> }
) {
  try {
    const { id: segments } = await params;
    if (!segments || segments.length === 0) {
      return NextResponse.json({ error: 'Missing article identifier' }, { status: 400 });
    }

    const identifier = segments[0];
    const isAdminDetail = segments[1] === 'admin';

    if (isAdminDetail) {
      const unauthorized = requireAdminApi(request);
      if (unauthorized) return unauthorized;

      const article = await prisma.article.findFirst({
        where: { OR: [{ slug: identifier }, { id: identifier }] },
        select: {
          id: true,
          slug: true,
          title: true,
          titleVi: true,
          summaryVi: true,
          briefVi: true,
          whyImportant: true,
          contentVi: true,
          sourceName: true,
          sourceUrl: true,
          originalUrl: true,
          originalTitle: true,
          originalPublishedAt: true,
          fetchedAt: true,
          publishedAt: true,
          category: true,
          tags: true,
          aiTags: true,
          targetAudience: true,
          impactLevel: true,
          importanceScore: true,
          reasonForScore: true,
          status: true,
          aiStatus: true,
          duplicateReason: true,
          identityKey: true,
          fingerprint: true,
          pendingFingerprint: true,
          contentChangedAt: true,
          identityReviewReason: true,
          originalText: true,
          originalLanguage: true,
          evidenceLevel: true,
          qualityFlags: true,
          processingReason: true,
          processingStatus: true,
          processingAttempts: true,
          nextRetryAt: true,
          leaseUntil: true,
          promptVersion: true,
          schemaVersion: true,
          inputHash: true,
          aiClaims: true,
          aiUncertainties: true,
          aiProvider: true,
          aiModel: true,
          aiError: true,
          scoreVersion: true,
          scoreBreakdown: true,
          publisherKey: true,
          sourceKind: true,
          eventKey: true,
          externalVersion: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!article) {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }

      const [attempts, audit] = await Promise.all([
        prisma.aiAttempt.findMany({ where: { articleId: article.id }, orderBy: { createdAt: 'desc' }, take: 20,
          select: { id: true, requestId: true, model: true, provider: true, status: true, errorCode: true, latencyMs: true,
            inputTokens: true, outputTokens: true, actualUsd: true, promptVersion: true, schemaVersion: true, createdAt: true } }),
        prisma.adminAudit.findMany({ where: { articleId: article.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
      ]);
      return NextResponse.json({ data: { ...article, attempts, audit } }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    const article = await prisma.article.findFirst({
      where: {
        status: 'published',
        OR: [{ slug: identifier }, { id: identifier }],
      },
      select: {
        slug: true,
        title: true,
        titleVi: true,
        summaryVi: true,
        briefVi: true,
        whyImportant: true,
        contentVi: true,
        sourceName: true,
        sourceUrl: true,
        originalUrl: true,
        originalTitle: true,
        originalPublishedAt: true,
        fetchedAt: true,
        publishedAt: true,
        category: true,
        tags: true,
        aiTags: true,
        targetAudience: true,
        impactLevel: true,
        importanceScore: true,
        reasonForScore: true,
        createdAt: true,
      },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json({ data: article });
  } catch (error) {
    console.error('GET /api/articles/[slug] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string[] }> }
) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const { id: segments } = await params;
    if (!segments || segments.length === 0) {
      return NextResponse.json({ error: 'Missing article identifier' }, { status: 400 });
    }

    const identifier = segments[0];
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const article = await prisma.article.findFirst({
      where: { OR: [{ slug: identifier }, { id: identifier }] },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const actor = getAdminPayloadFromRequest(request)!.username;
    const updateData: Prisma.ArticleUpdateManyMutationInput = {};
    const action = body.action === 'reprocess' ? 'reprocess' : body.status === 'published' ? 'approve' : body.status === 'rejected' ? 'reject' : 'edit';
    if ('action' in body && body.action !== 'reprocess') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    if ('reviewReason' in body && (typeof body.reviewReason !== 'string' || body.reviewReason.length > 1000)) return NextResponse.json({ error: 'Invalid reviewReason' }, { status: 400 });
    if (action === 'reprocess') {
      if (article.status === 'published') return NextResponse.json({ error: 'Published articles cannot be reprocessed in place' }, { status: 409 });
      if (article.identityReviewReason || article.pendingFingerprint || article.duplicateOfId || !article.identityKey || !article.originalText) return NextResponse.json({ error: 'Resolve source identity/content evidence before reprocessing' }, { status: 409 });
      if (typeof body.reviewReason !== 'string' || body.reviewReason.trim().length < 8) return NextResponse.json({ error: 'Reprocess reason must contain at least 8 characters' }, { status: 400 });
      if ('force' in body && typeof body.force !== 'boolean') return NextResponse.json({ error: 'Invalid force' }, { status: 400 });
      Object.assign(updateData, { status: 'pending', processingStatus: 'queued', processingAttempts: 0, processingReason: 'admin-reprocess', nextRetryAt: null, aiError: '' });
    }

    if ('status' in body) {
      if (typeof body.status !== 'string' || !allowedStatuses.has(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      if (action === 'reprocess') return NextResponse.json({ error: 'Reprocess cannot be combined with a status change' }, { status: 400 });
      updateData.status = body.status;
      updateData.processingStatus = body.status === 'published' ? 'ready' : 'review';
      if (body.status === 'published') {
        const requiresOverride = article.qualityFlags !== '[]' || article.identityReviewReason || article.pendingFingerprint ||
          !article.originalPublishedAt || article.evidenceLevel === 'title_only' || !article.canonicalUrl || !article.identityKey || !article.summaryVi;
        if (requiresOverride && (body.reviewOverride !== true || typeof body.reviewReason !== 'string' || body.reviewReason.trim().length < 12)) {
          return NextResponse.json({ error: 'Quality/evidence gate requires explicit reviewOverride and a reviewReason of at least 12 characters' }, { status: 409 });
        }
        updateData.processingReason = requiresOverride ? 'admin-approved-with-reviewed-exceptions' : 'admin-approved';
      }
      if (body.status === 'published' && !article.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    for (const field of ['title', 'titleVi', 'summaryVi', 'briefVi', 'whyImportant', 'contentVi', 'category', 'tags', 'aiTags', 'targetAudience', 'impactLevel', 'reasonForScore'] as const) {
      if (field in body) {
        if (typeof body[field] !== 'string' || body[field].length > (field === 'contentVi' ? 100_000 : 5000)) {
          return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
        }
        updateData[field] = body[field].trim();
      }
    }

    if ('importanceScore' in body) {
      const score = Number(body.importanceScore);
      if (!Number.isInteger(score) || score < 0 || score > 100) {
        return NextResponse.json({ error: 'Invalid importanceScore' }, { status: 400 });
      }
      updateData.importanceScore = score;
    }

    if (typeof updateData.category === 'string') updateData.category = normalizeCategory(updateData.category, article.originalTitle);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    Object.assign(updateData, { leaseOwner: null, leaseUntil: null });
    if (action === 'edit' && article.processingStatus === 'processing') Object.assign(updateData, { processingStatus: 'review', processingReason: 'admin-edited-during-processing', nextRetryAt: null });
    const snapshot = (value: typeof article) => ({ status: value.status, title: value.title, titleVi: value.titleVi, summaryVi: value.summaryVi,
      contentVi: value.contentVi, category: value.category, tags: value.tags, processingStatus: value.processingStatus, processingAttempts: value.processingAttempts,
      processingReason: value.processingReason, slug: value.slug, qualityFlags: value.qualityFlags });
    const updated = await prisma.$transaction(async (transaction) => {
      const changed = await transaction.article.updateMany({ where: { id: article.id, updatedAt: article.updatedAt }, data: updateData });
      if (!changed.count) return null;
      if (action === 'reprocess' && body.force === true) await transaction.aiResultCache.deleteMany({ where: { articleId: article.id } });
      const after = await transaction.article.findUniqueOrThrow({ where: { id: article.id } });
      await transaction.adminAudit.create({ data: { actor, action, articleId: article.id, beforeJson: JSON.stringify(snapshot(article)),
        afterJson: JSON.stringify({ ...snapshot(after), reviewReason: body.reviewReason || '', force: body.force === true }) } });
      return after;
    });
    if (!updated) return NextResponse.json({ error: 'Article changed; reload before editing' }, { status: 409 });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('PATCH /api/articles/[slug] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
