import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string[] }> }
) {
  try {
    const { id: segments } = await params;

    if (!segments || segments.length === 0) {
      return NextResponse.json({ error: 'Missing article identifier' }, { status: 400 });
    }

    const identifier = segments[0];

    // Find by slug or by id
    const article = await prisma.article.findFirst({
      where: {
        OR: [{ slug: identifier }, { id: identifier }],
      },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Check permission: only published articles are publicly viewable
    const isPublicView = segments.length === 1 || segments[1] !== 'admin';
    if (isPublicView && article.status !== 'published') {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json({ data: article });
  } catch (error) {
    console.error('GET /api/articles/[slug] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string[] }> }
) {
  try {
    const { id: segments } = await params;
    if (!segments || segments.length === 0) {
      return NextResponse.json({ error: 'Missing article identifier' }, { status: 400 });
    }

    const identifier = segments[0];
    const body = await request.json();

    const article = await prisma.article.findFirst({
      where: { OR: [{ slug: identifier }, { id: identifier }] },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Allowed fields for update
    const allowedFields = ['status', 'summaryVi', 'contentVi', 'category', 'tags', 'importanceScore', 'reasonForScore'];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
