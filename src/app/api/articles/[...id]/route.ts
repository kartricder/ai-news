import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/authGuard';

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
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!article) {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }

      return NextResponse.json({ data: article });
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
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const article = await prisma.article.findFirst({
      where: { OR: [{ slug: identifier }, { id: identifier }] },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const updateData: {
      status?: string;
      title?: string;
      titleVi?: string;
      summaryVi?: string;
      briefVi?: string;
      whyImportant?: string;
      contentVi?: string;
      category?: string;
      tags?: string;
      aiTags?: string;
      targetAudience?: string;
      impactLevel?: string;
      importanceScore?: number;
      reasonForScore?: string;
      publishedAt?: Date;
    } = {};

    if ('status' in body) {
      if (typeof body.status !== 'string' || !allowedStatuses.has(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = body.status;
      if (body.status === 'published' && !article.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    for (const field of ['title', 'titleVi', 'summaryVi', 'briefVi', 'whyImportant', 'contentVi', 'category', 'tags', 'aiTags', 'targetAudience', 'impactLevel', 'reasonForScore'] as const) {
      if (field in body) {
        if (typeof body[field] !== 'string') {
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

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.article.update({
      where: { id: article.id },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('PATCH /api/articles/[slug] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
