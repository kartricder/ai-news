import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getAdminPayloadFromRequest } from '@/lib/authGuard';

const allowedStatuses = new Set(['draft', 'pending', 'published', 'rejected']);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isAdmin = Boolean(getAdminPayloadFromRequest(request));

    const requestedStatus = searchParams.get('status') || undefined;
    const status = requestedStatus && allowedStatuses.has(requestedStatus) ? requestedStatus : undefined;
    const category = searchParams.get('category') || undefined;
    const source = searchParams.get('source') || undefined;
    const search = searchParams.get('search') || undefined;

    if (!isAdmin && status && status !== 'published') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '12', 10)));
    const skip = (page - 1) * pageSize;

    const where: Prisma.ArticleWhereInput = {};
    where.status = isAdmin ? status : 'published';
    if (category) where.category = category;
    if (source) where.sourceName = source;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { summaryVi: { contains: search } },
        { sourceName: { contains: search } },
        { category: { contains: search } },
      ];
    }

    const allowedSortFields = ['createdAt', 'importanceScore', 'publishedAt', 'title', 'sourceName'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy: Prisma.ArticleOrderByWithRelationInput = {
      [safeSortBy]: sortOrder,
    };

    const select = isAdmin
      ? {
          id: true,
          slug: true,
          title: true,
          summaryVi: true,
          contentVi: true,
          sourceName: true,
          sourceUrl: true,
          originalUrl: true,
          category: true,
          tags: true,
          importanceScore: true,
          reasonForScore: true,
          status: true,
          publishedAt: true,
          createdAt: true,
        }
      : {
          slug: true,
          title: true,
          summaryVi: true,
          sourceName: true,
          sourceUrl: true,
          originalUrl: true,
          category: true,
          tags: true,
          importanceScore: true,
          publishedAt: true,
          createdAt: true,
        };

    const [total, articles] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return NextResponse.json({
      data: articles,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('GET /api/articles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
